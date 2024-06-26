// ************************
// compile-time environment
// ************************/

import { push } from "./utilities";
import { builtins, added_builtins, constants } from "./builtins";
import { Instruction, InstructionType } from "./machine";
import {
  BlockComp,
  WhileComp,
  NameComp,
  AppComp,
  Component,
} from "./ComponentClass";

// a compile-time environment is an array of
// compile-time frames, and a compile-time frame
// is an array of symbols

// find the position [frame-index, value-index]
// of a given symbol x
const compile_time_environment_position = (env: string[][], x: string) => {
  let frame_index = env.length;
  while (value_index(env[--frame_index], x) === -1) {}
  return [frame_index, value_index(env[frame_index], x)] as const;
};

const value_index = (frame: string[], x: string) => {
  for (let i = 0; i < frame.length; i++) {
    if (frame[i] === x) return i;
  }
  return -1;
};

const compile_time_environment_extend = (vs: unknown[], e: unknown[][]) => {
  //  make shallow copy of e
  return push([...e], vs);
};

// compile-time frames only need symbols (keys), no values
const builtin_compile_frame = Object.keys(builtins);
const added_builtins_compile_frame = Object.keys(added_builtins);
const constant_compile_frame = Object.keys(constants);
const global_compile_environment = [
  builtin_compile_frame,
  added_builtins_compile_frame,
  constant_compile_frame,
];

// ********
// compiler
// ********

// scanning out the declarations from (possibly nested)
// sequences of statements, ignoring blocks
const scan_for_locals = (comp: any) =>
  comp.tag === "seq"
    ? comp.stmts.reduce((acc, x) => acc.concat(scan_for_locals(x)), [])
    : ["var", "const", "fun"].includes(comp.tag)
      ? [comp.sym]
      : comp.tag === "variables"
        ? comp.symbols
        : [];

const compile_sequence = (seq: any[], ce: any) => {
  if (seq.length === 0) return (instrs[wc++] = { tag: "LDC", val: undefined });
  let first = true;
  for (let comp of seq) {
    first ? (first = false) : (instrs[wc++] = { tag: "POP" });
    compile(comp, ce);
  }
};

// wc: write counter
let wc: number;
// instrs: instruction array
let instrs: Instruction[];

const mutex_functions_list = ["Lock", "Unlock"];
const waitgroups_functions_list = ["Add", "Done", "Wait"];

const compile_comp = {
  Literal: (comp, ce) => {
    instrs[wc++] = { tag: "LDC", val: comp.value };
  },
  nam:
    // store precomputed position information in LD instruction
    (comp, ce) => {
      instrs[wc++] = {
        tag: "LD",
        sym: comp.sym,
        pos: compile_time_environment_position(ce, comp.sym),
      };
    },
  unop: (comp, ce) => {
    compile(comp.expr, ce);
    instrs[wc++] = { tag: "UNOP", sym: comp.sym };
  },
  binop: (comp, ce) => {
    compile(comp.first, ce);
    compile(comp.second, ce);
    instrs[wc++] = { tag: "BINOP", sym: comp.sym };
  },
  log: (comp, ce) => {
    compile(
      comp.sym == "&&"
        ? {
            tag: "cond_expr",
            pred: comp.first,
            cons: { tag: "Literal", val: true },
            alt: comp.second,
          }
        : {
            tag: "cond_expr",
            pred: comp.first,
            cons: comp.second,
            alt: { tag: "Literal", val: false },
          },
      ce,
    );
  },
  cond: (comp, ce) => {
    compile(comp.pred, ce);
    const jump_on_false_instruction: InstructionType<"JOF"> = {
      tag: "JOF",
      addr: -1,
    };
    instrs[wc++] = jump_on_false_instruction;
    compile(comp.cons, ce);
    const goto_instruction: InstructionType<"GOTO"> = {
      tag: "GOTO",
      addr: -1,
    };
    instrs[wc++] = goto_instruction;
    const alternative_address = wc;
    jump_on_false_instruction.addr = alternative_address;
    compile(comp.alt, ce);
    goto_instruction.addr = wc;
  },
  while: (comp, ce) => {
    // If there is a init statement, place it within its own block
    if (comp.init !== null) {
      const new_while = new WhileComp(comp.pred, comp.body, null, comp.post);
      const new_comp = new BlockComp([comp.init, new_while]);
      compile(new_comp, ce);
      return;
    }
    const while_mark: InstructionType<"WHILE_MARK"> = {
      tag: "WHILE_MARK",
      start: -1,
      end: -1,
    };
    instrs[wc++] = while_mark;
    const loop_start = wc;
    compile(comp.pred, ce);
    const jump_on_false_instruction: InstructionType<"JOF"> = {
      tag: "JOF",
      addr: -1,
    };
    instrs[wc++] = jump_on_false_instruction;
    compile(comp.body, ce);
    instrs[wc++] = { tag: "POP" };
    while_mark.start = wc; // continue should execute the post statement
    if (comp.post) {
      compile(comp.post, ce);
      instrs[wc++] = { tag: "POP" }; //pop out the post value
    }
    instrs[wc++] = { tag: "GOTO", addr: loop_start };
    jump_on_false_instruction.addr = wc;
    while_mark.end = wc;
    instrs[wc++] = { tag: "EXIT_WHILE" };
    instrs[wc++] = { tag: "LDC", val: undefined };
  },
  break_cont: (comp, ce) => {
    instrs[wc++] = { tag: "BREAK_CONT", type: comp.type };
  },
  app: (comp, ce) => {
    //compile "function calls" that are actually mutex/waitgroups operations differently
    if (
      comp.fun.sym !== undefined &&
      mutex_functions_list.includes(comp.fun.sym)
    ) {
      //don't allow more than one argument for mutex operations
      if (comp.args.length !== 1) {
        throw new Error("More than one argument for mutex operations");
      }
      //compile the argument, which should produce the mutex address on the OS
      compile(comp.args[0], ce);
      compile({ tag: "mutex", op: comp.fun.sym }, ce);
      return;
    } else if (
      comp.fun.sym !== undefined &&
      waitgroups_functions_list.includes(comp.fun.sym)
    ) {
      //don't allow more than one argument for waitgroups operations
      if (comp.args.length !== 1) {
        throw new Error("More than one argument for waitgroups operations");
      }
      //compile the argument, which should produce the mutex address on the OS
      compile(comp.args[0], ce);
      compile({ tag: "waitgroup", op: comp.fun.sym }, ce);
      return;
    }
    //compile actual functions call
    compile(comp.fun, ce);
    for (let arg of comp.args) {
      compile(arg, ce);
    }
    instrs[wc++] = { tag: "CALL", arity: comp.args.length };
  },
  mutex: (comp, ce) => {
    instrs[wc++] = { tag: "MUTEX", type: comp.op };
  },
  waitgroup: (comp, ce) => {
    instrs[wc++] = { tag: "WAITGROUP", type: comp.op };
  },
  send: (comp, ce) => {
    compile(comp.chan, ce);
    compile(comp.value, ce);
    instrs[wc++] = { tag: "SEND" };
  },
  receive: (comp, ce) => {
    compile(comp.chan, ce);
    instrs[wc++] = { tag: "RECEIVE" };
  },
  go: (comp, ce) => {
    compile(comp.fun, ce);
    for (let arg of comp.args) {
      compile(arg, ce);
    }
    instrs[wc++] = { tag: "GO", arity: comp.args.length };
  },
  assmt: (comp, ce) => {
    if (comp.lhs_expressions.length !== comp.rhs_expressions.length) {
      if (
        // Only allow non-matching if RHS is a single function call,
        // which can return multiple values.
        !(
          comp.rhs_expressions.length === 1 &&
          comp.lhs_expressions.length > 1 &&
          comp.rhs_expressions[0].tag === "app"
        )
      ) {
        throw new Error("Number of LHS and RHS expressions do not match");
      }
    }
    for (const expr of comp.rhs_expressions) {
      compile(expr, ce);
    }
    // Assign to variables in reverse order
    for (let i = comp.lhs_expressions.length - 1; i >= 0; i--) {
      const lhs = comp.lhs_expressions[i];
      if (lhs.tag === "nam") {
        instrs[wc++] = {
          tag: "ASSIGN",
          pos: compile_time_environment_position(ce, lhs.sym),
        };
      } else {
        compile(lhs, ce);
      }
      // Pop values from operand stack after assignment
      if (i !== 0) {
        instrs[wc++] = { tag: "POP" };
      }
    }
  },
  lam: (comp, ce) => {
    instrs[wc++] = { tag: "LDF", arity: comp.arity, addr: wc + 1 };
    // jump over the body of the lambda expression
    const goto_instruction: InstructionType<"GOTO"> = {
      tag: "GOTO",
      addr: -1,
    };
    instrs[wc++] = goto_instruction;
    // extend compile-time environment
    compile(comp.body, compile_time_environment_extend(comp.prms, ce));
    instrs[wc++] = { tag: "RESET" };
    goto_instruction.addr = wc;
  },
  seq: (comp, ce) => compile_sequence(comp.stmts, ce),
  blk: (comp, ce) => {
    const locals = scan_for_locals(comp.body);
    instrs[wc++] = { tag: "ENTER_SCOPE", num: locals.length };
    compile(
      comp.body,
      // extend compile-time environment
      compile_time_environment_extend(locals, ce),
    );
    instrs[wc++] = { tag: "EXIT_SCOPE" };
  },
  var: (comp, ce) => {
    compile(comp.expr, ce);
    instrs[wc++] = {
      tag: "ASSIGN",
      pos: compile_time_environment_position(ce, comp.sym),
    };
  },
  variables: (comp, ce) => {
    if (comp.symbols.length !== comp.expressions.length) {
      if (
        // Only allow non-matching if RHS is a single function call,
        // which can return multiple values.
        !(
          comp.expressions.length === 1 &&
          comp.symbols.length > 1 &&
          comp.expressions[0].tag === "app"
        )
      ) {
        throw new Error("Number of variables and expressions do not match");
      }
    }
    for (const expr of comp.expressions) {
      compile(expr, ce);
    }
    // Assign to variables in reverse order
    for (let i = comp.symbols.length - 1; i >= 0; i--) {
      const sym = comp.symbols[i];
      instrs[wc++] = {
        tag: "ASSIGN",
        pos: compile_time_environment_position(ce, sym),
      };
      // Pop values from operand stack after assignment
      if (i !== 0) {
        instrs[wc++] = { tag: "POP" };
      }
    }
  },
  const: (comp, ce) => {
    compile(comp.expr, ce);
    instrs[wc++] = {
      tag: "ASSIGN",
      pos: compile_time_environment_position(ce, comp.sym),
    };
  },
  ret: (comp, ce) => {
    for (const expr of comp.expressions) {
      compile(expr, ce);
    }
    if (comp.expressions.length === 1 && comp.expressions.tag === "app") {
      // tail call: turn CALL into TAILCALL
      instrs[wc - 1].tag = "TAIL_CALL";
    } else {
      instrs[wc++] = { tag: "RESET" };
    }
  },
  fun: (comp, ce) => {
    compile(
      {
        tag: "const",
        sym: comp.sym,
        expr: {
          tag: "lam",
          prms: comp.prms,
          arity: comp.prms.length,
          body: comp.body,
        },
      },
      ce,
    );
  },
  array_create: (comp, ce) => {
    //compile the initial assignments into the array
    for (let arg of comp.initial) {
      compile(arg, ce);
    }
    //compile the size of the array
    compile(comp.size, ce);
    //Add machine instruction
    instrs[wc++] = { tag: "SLICE_CREATE", init_size: comp.initial.length };
  },
  slice_create: (comp, ce) => {
    //push the address of the array reflected by the expression onto the OS
    //Then, push low, high, max onto the OS, max on top.
    [comp.array, comp.low, comp.high, comp.max].forEach((comp) =>
      compile(comp, ce),
    );
    instrs[wc++] = { tag: "CUT_SLICE" };
  },
  index_get: (comp, ce) => {
    compile(comp.source, ce);
    compile(comp.index, ce);
    instrs[wc++] = { tag: "SLICE_GET_ELEMENT" };
  },
  index_set: (comp, ce) => {
    compile(comp.source, ce);
    compile(comp.index, ce);
    instrs[wc++] = { tag: "SLICE_SET_ELEMENT" };
  },
};

// compile component into instruction array instrs,
// starting at wc (write counter)
const compile = (comp, ce) => {
  // console.log(comp)
  compile_comp[comp.tag](comp, ce);
};

// compile program into instruction array instrs, after initializing wc and instrs
export function compile_program(program: any) {
  wc = 0;
  instrs = [];
  compile(program, global_compile_environment);
  instrs[wc] = { tag: "DONE" };

  return instrs;
}
