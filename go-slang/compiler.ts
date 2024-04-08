// ************************
// compile-time environment
// ************************/

import { push } from "./utilities"
import { builtins, constants } from "./builtins"
import { Instruction, InstructionType } from "./machine"

// a compile-time environment is an array of
// compile-time frames, and a compile-time frame
// is an array of symbols

// find the position [frame-index, value-index]
// of a given symbol x
const compile_time_environment_position = (env: string[][], x: string) => {
    let frame_index = env.length
    while (value_index(env[--frame_index], x) === -1) {}
    return [frame_index, value_index(env[frame_index], x)] as const
}

const value_index = (frame: string[], x: string) => {
  for (let i = 0; i < frame.length; i++) {
    if (frame[i] === x) return i
  }
  return -1;
}

const compile_time_environment_extend = (vs: unknown[], e: unknown[][]) => {
    //  make shallow copy of e
    return push([...e], vs)
}

// compile-time frames only need symbols (keys), no values
const builtin_compile_frame = Object.keys(builtins)
const constant_compile_frame = Object.keys(constants)
const global_compile_environment =
        [builtin_compile_frame, constant_compile_frame]

// ********
// compiler
// ********

// scanning out the declarations from (possibly nested)
// sequences of statements, ignoring blocks
const scan_for_locals = (comp: any) =>
    comp.tag === 'seq'
    ? comp.stmts.reduce((acc, x) =>
                        acc.concat(scan_for_locals(x)),
                        [])
    : ['var', 'const', 'fun'].includes(comp.tag)
    ? [comp.sym]
    : []

const compile_sequence = (seq: any[], ce: any) => {
    if (seq.length === 0)
        return instrs[wc++] = {tag: "LDC", val: undefined}
    let first = true
    for (let comp of seq) {
        first ? first = false
              : instrs[wc++] = {tag: 'POP'}
        compile(comp, ce)
    }
}

// wc: write counter
let wc: number
// instrs: instruction array
let instrs: Instruction[]

const compile_comp = {
Literal:
    (comp, ce) => {
        instrs[wc++] = { tag: "LDC",
                         val: comp.value
        }
    },
nam:
    // store precomputed position information in LD instruction
    (comp, ce) => {
        instrs[wc++] = { tag: "LD",
                         sym: comp.sym,
                         pos: compile_time_environment_position(
                                  ce, comp.sym)
                        }
    },
unop:
    (comp, ce) => {
        compile(comp.expr, ce)
        instrs[wc++] = {tag: 'UNOP', sym: comp.sym}
    },
binop:
    (comp, ce) => {
        compile(comp.first, ce)
        compile(comp.second, ce)
        instrs[wc++] = {tag: 'BINOP', sym: comp.sym}
    },
log:
    (comp, ce) => {
        compile(comp.sym == '&&'
                ? {tag: 'cond_expr',
                   pred: comp.first,
                   cons: {tag: 'Literal', val: true},
                   alt: comp.second}
                : {tag: 'cond_expr',
                   pred: comp.first,
                   cons: comp.second,
                   alt: {tag: 'Literal', val: false}},
	            ce)
    },
cond:
    (comp, ce) => {
        compile(comp.pred, ce)
        const jump_on_false_instruction: InstructionType<'JOF'> = {tag: 'JOF', addr: -1}
        instrs[wc++] = jump_on_false_instruction
        compile(comp.cons, ce)
        const goto_instruction: InstructionType<'GOTO'> = {tag: 'GOTO', addr: -1}
        instrs[wc++] = goto_instruction;
        const alternative_address = wc;
        jump_on_false_instruction.addr = alternative_address;
        compile(comp.alt, ce)
        goto_instruction.addr = wc
    },
while:
    (comp, ce) => {
        const while_mark : InstructionType<'WHILE_MARK'> = {tag : 'WHILE_MARK', start: -1, end: -1}
        instrs[wc++] = while_mark;
        const loop_start = wc;
        while_mark.start = wc;
        compile(comp.pred, ce)
        const jump_on_false_instruction: InstructionType<'JOF'> = {tag: 'JOF', addr: -1}
        instrs[wc++] = jump_on_false_instruction
        compile(comp.body, ce)
        instrs[wc++] = {tag: 'POP'}
        instrs[wc++] = {tag: 'GOTO', addr: loop_start}
        jump_on_false_instruction.addr = wc;
        while_mark.end = wc;
        instrs[wc++] = {tag: 'LDC', val: undefined}
    },
break_cont:
    (comp, ce) => {
        instrs[wc++] = {tag: 'BREAK_CONT', type: comp.type}
},
app:
    (comp, ce) => {
        compile(comp.fun, ce)
        for (let arg of comp.args) {
            compile(arg, ce)
        }
        instrs[wc++] = {tag: 'CALL', arity: comp.args.length}
    },
go:
    (comp, ce) => {
        compile(comp.fun, ce)
        for (let arg of comp.args) {
            compile(arg, ce)
        }
        instrs[wc++] = {tag: 'GO', arity: comp.args.length}
    },
assmt:
    // store precomputed position info in ASSIGN instruction
    (comp, ce) => {
        compile(comp.expr, ce)
        instrs[wc++] = {tag: 'ASSIGN',
                        pos: compile_time_environment_position(
                                 ce, comp.sym)}
    },
lam:
    (comp, ce) => {
        instrs[wc++] = {tag: 'LDF',
                        arity: comp.arity,
                        addr: wc + 1};
        // jump over the body of the lambda expression
        const goto_instruction: InstructionType<'GOTO'> = {tag: 'GOTO', addr: -1}
        instrs[wc++] = goto_instruction
        // extend compile-time environment
        compile(comp.body,
		        compile_time_environment_extend(
		            comp.prms, ce))
        instrs[wc++] = {tag: 'LDC', val: undefined}
        instrs[wc++] = {tag: 'RESET'}
        goto_instruction.addr = wc;
    },
seq:
    (comp, ce) => compile_sequence(comp.stmts, ce),
blk:
    (comp, ce) => {
        const locals = scan_for_locals(comp.body)
        instrs[wc++] = {tag: 'ENTER_SCOPE', num: locals.length}
        compile(comp.body,
                // extend compile-time environment
		        compile_time_environment_extend(
		            locals, ce))
        instrs[wc++] = {tag: 'EXIT_SCOPE'}
    },
var:
    (comp, ce) => {
        compile(comp.expr, ce)
        instrs[wc++] = {tag: 'ASSIGN',
                        pos: compile_time_environment_position(
                                 ce, comp.sym)}
    },
const:
    (comp, ce) => {
        compile(comp.expr, ce)
        instrs[wc++] = {tag: 'ASSIGN',
                        pos: compile_time_environment_position(
                                 ce, comp.sym)}
    },
ret:
    (comp, ce) => {
        compile(comp.expr, ce)
        if (comp.expr.tag === 'app') {
            // tail call: turn CALL into TAILCALL
            instrs[wc - 1].tag = 'TAIL_CALL'
        } else {
            instrs[wc++] = {tag: 'RESET'}
        }
    },
fun:
    (comp, ce) => {
        compile(
            {tag:  'const',
             sym:  comp.sym,
             expr: {tag: 'lam',
                    prms: comp.prms,
                    arity : comp.prms.length,
                    body: comp.body}},
	        ce)
    }
}

// compile component into instruction array instrs,
// starting at wc (write counter)
const compile = (comp, ce) => {
    // console.log(comp)
    compile_comp[comp.tag](comp, ce)
}

// compile program into instruction array instrs, after initializing wc and instrs
export function compile_program(program: any) {
    wc = 0
    instrs = []
    compile(program, global_compile_environment)
    instrs[wc] = {tag: 'DONE'}

    return instrs
}
