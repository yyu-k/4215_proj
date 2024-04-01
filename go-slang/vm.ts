import { Heap } from './heap'
import { arity, error, peek, push, word_to_string } from './utilities'

const type_check_generator = (type: string) => {
    return (x: unknown) => {
        if (typeof x === type) {
            return true
        }
        return false
    }
}
const is_boolean = type_check_generator('boolean')
const is_number = type_check_generator('number')
const is_undefined = type_check_generator('undefined')
const is_null = type_check_generator('null')

const JS_value_to_address = (heap: Heap, x: unknown) => {
    return is_boolean(x)
    ? (x ? heap.values.True : heap.values.False)
    : is_number(x)
    ? heap.allocate_Number(x as number)
    : is_undefined(x)
    ? heap.values.Undefined
    : is_null(x)
    ? heap.values.Null
    : "unknown word tag: " + word_to_string(x as number)
}

// ************************
// compile-time environment
// ************************/

// a compile-time environment is an array of
// compile-time frames, and a compile-time frame
// is an array of symbols

// find the position [frame-index, value-index]
// of a given symbol x
const compile_time_environment_position = (env: string[][], x: string) => {
    let frame_index = env.length
    while (value_index(env[--frame_index], x) === -1) {}
    return [frame_index, value_index(env[frame_index], x)]
}

const value_index = (frame: string[], x: string) => {
  for (let i = 0; i < frame.length; i++) {
    if (frame[i] === x) return i
  }
  return -1;
}

// in this machine, the builtins take their
// arguments directly from the operand stack,
// to save the creation of an intermediate
// argument array
const builtin_implementation = {
    display       : () => {
                        const address = OS.pop()!
                        console.log(heap.address_to_JS_value(address))
                        return address
                    },
    error         : () => error(heap.address_to_JS_value(OS.pop()!)),
    pair          : () => {
                        const tl = OS.pop()!
                        const hd = OS.pop()!
                        return heap.allocate_Pair(hd, tl)
                    },
    is_pair       : () => heap.is_Pair(OS.pop()!) ? heap.values.True : heap.values.False,
    head          : () => heap.get_child(OS.pop()!, 0),
    tail          : () => heap.get_child(OS.pop()!, 1),
    is_null       : () => heap.is_Null(OS.pop()!) ? heap.values.True : heap.values.False,
    set_head      : () => {
                        const val = OS.pop()!
                        const p = OS.pop()!
                        heap.set_child(p, 0, val)
                    },
    set_tail      : () => {
                        const val = OS.pop()!
                        const p = OS.pop()!
                        heap.set_child(p, 1, val)
                    }
}

const builtins = {}
const builtin_array: (() => {})[] = []
{
    let i = 0
    for (const key in builtin_implementation) {
        builtins[key] =
            { tag:   'BUILTIN',
              id:    i,
              arity: arity(builtin_implementation[key])
            }
        builtin_array[i++] = builtin_implementation[key]
    }
}

const constants = {
    // `allocate_constant_frame` sets this up
    undefined     : undefined
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
let instrs: any[]

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
        compile(comp.first, ce)
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
        const jump_on_false_instruction = {tag: 'JOF', addr: -1}
        instrs[wc++] = jump_on_false_instruction
        compile(comp.cons, ce)
        const goto_instruction = {tag: 'GOTO', addr: -1}
        instrs[wc++] = goto_instruction;
        const alternative_address = wc;
        jump_on_false_instruction.addr = alternative_address;
        compile(comp.alt, ce)
        goto_instruction.addr = wc
    },
while:
    (comp, ce) => {
        const loop_start = wc
        compile(comp.pred, ce)
        const jump_on_false_instruction = {tag: 'JOF', addr: -1}
        instrs[wc++] = jump_on_false_instruction
        compile(comp.body, ce)
        instrs[wc++] = {tag: 'POP'}
        instrs[wc++] = {tag: 'GOTO', addr: loop_start}
        jump_on_false_instruction.addr = wc
        instrs[wc++] = {tag: 'LDC', val: undefined}
    },
app:
    (comp, ce) => {
        compile(comp.fun, ce)
        for (let arg of comp.args) {
            compile(arg, ce)
        }
        instrs[wc++] = {tag: 'CALL', arity: comp.args.length}
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
        const goto_instruction = {tag: 'GOTO', addr: -1}
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

// compile program into instruction array instrs,
// after initializing wc and instrs
export const compile_program = (program) => {
    wc = 0
    instrs = []
    compile(program, global_compile_environment)
    instrs[wc] = {tag: 'DONE'}

    return instrs
}

// **********************
// operators and builtins
// **********************/

const binop_microcode = {
    '+': (x, y)   => (is_number(x) && is_number(y))
                     // || (is_string(x) && is_string(y))
                     ? x + y
                     : error([x,y], "+ expects two numbers" +
                                    " or two strings, got:"),
    // todo: add error handling to JS for the following, too
    '*':   (x, y) => x * y,
    '-':   (x, y) => x - y,
    '/':   (x, y) => x / y,
    '%':   (x, y) => x % y,
    '<':   (x, y) => x < y,
    '<=':  (x, y) => x <= y,
    '>=':  (x, y) => x >= y,
    '>':   (x, y) => x > y,
    '==': (x, y) => x === y,
    '!=': (x, y) => x !== y
}

// v2 is popped before v1
const apply_binop = (heap: Heap, op: string, v2: number, v1: number) =>
    JS_value_to_address(heap,
        binop_microcode[op](heap.address_to_JS_value(v1),
                            heap.address_to_JS_value(v2)))

const unop_microcode = {
    '-unary': x => - x,
    '!'     : x => ! x
}

const apply_unop = (op: string, v: number) =>
    JS_value_to_address(heap, unop_microcode[op](heap.address_to_JS_value(v)))

const apply_builtin = (builtin_id: number) => {
    // console.log(builtin_id, "apply_builtin: builtin_id:")
    const result = builtin_array[builtin_id]()
    OS.pop() // pop fun
    push(OS, result)
}

// *******
// machine
// *******

// machine registers
let OS: number[]   // JS array (stack) of words (Addresses, word-encoded literals, numbers)
let PC: number     // JS number
let E: number      // heap Address
let RTS: number[]  // JS array (stack) of Addresses
// TODO: Remove this global heap
let heap: Heap

const microcode = {
LDC:
    instr =>
    push(OS, JS_value_to_address(heap, instr.val)),
UNOP:
    instr =>
    push(OS, apply_unop(instr.sym, OS.pop()!)),
BINOP:
    instr =>
    push(OS,
         apply_binop(heap, instr.sym, OS.pop()!, OS.pop()!)),
POP:
    instr =>
    OS.pop(),
JOF:
    instr =>
    PC = heap.is_True(OS.pop()!) ? PC : instr.addr,
GOTO:
    instr =>
    PC = instr.addr,
ENTER_SCOPE:
    instr => {
        push(RTS, heap.allocate_Blockframe(E))
        const frame_address = heap.allocate_Frame(instr.num)
        // AMENDED
        push(RTS, frame_address); //prevent frame_address from getting deallocated when extending environment
        E = heap.extend_Environment(frame_address, E)
        RTS.pop(); //pop frame_address
        for (let i = 0; i < instr.num; i++) {
            heap.set_child(frame_address, i, heap.values.Unassigned)
        }
    },
EXIT_SCOPE:
    instr =>
    E = heap.get_Blockframe_environment(RTS.pop()!),
LD:
    instr => {
        const val = heap.get_Environment_value(E, instr.pos)
        if (heap.is_Unassigned(val))
            error("access of unassigned variable")
        push(OS, val)
    },
ASSIGN:
    instr =>
    heap.set_Environment_value(E, instr.pos, peek(OS,0)),
LDF:
    instr => {
        const closure_address =
                  heap.allocate_Closure(
                      instr.arity, instr.addr, E)
        push(OS, closure_address)
    },
CALL:
    instr => {
        const arity = instr.arity
        const fun = peek(OS, arity)
        if (heap.is_Builtin(fun)) {
            return apply_builtin(heap.get_Builtin_id(fun))
        }
        const new_PC = heap.get_Closure_pc(fun)
        const new_frame = heap.allocate_Frame(arity)
        for (let i = arity - 1; i >= 0; i--) {
            heap.set_child(new_frame, i, OS.pop()!)
        }
        OS.pop() // pop fun
        //AMENDED
        //need to make sure that new_frame does not get deallocated before CALL exits
        //since new_frame is not currently referenced anywhere
        push(RTS, new_frame); //prevent new_frame from getting deallocated when allocating Callframe
        const callframe_address = heap.allocate_Callframe(E, PC)
        RTS.pop(); //remove new_frame from RTS
        push(RTS, callframe_address);
        push(RTS, new_frame); //prevent new_frame from getting deallocated when extending environment
        E = heap.extend_Environment(
                new_frame,
                heap.get_Closure_environment(fun))
        RTS.pop(); //remove new_frame from RTS
        PC = new_PC
    },
TAIL_CALL:
    instr => {
        const arity = instr.arity
        const fun = peek(OS, arity)
        if (heap.is_Builtin(fun)) {
            return apply_builtin(heap.get_Builtin_id(fun))
        }
        const new_PC = heap.get_Closure_pc(fun)
        const new_frame = heap.allocate_Frame(arity)
        for (let i = arity - 1; i >= 0; i--) {
            heap.set_child(new_frame, i, OS.pop()!)
        }
        OS.pop() // pop fun
        // AMENDED
        push(RTS, new_frame); //prevent new_frame from getting deallocated when extending environment
        // don't push on RTS here
        E = heap.extend_Environment(
                new_frame,
                heap.get_Closure_environment(fun))
        RTS.pop(); //remove new_frame from RTS
        PC = new_PC
    },
RESET:
    instr => {
        // keep popping...
        const top_frame = RTS.pop()!
        if (heap.is_Callframe(top_frame)) {
            // ...until top frame is a call frame
            PC = heap.get_Callframe_pc(top_frame)
            E = heap.get_Callframe_environment(top_frame)
        } else {
	    PC--
        }
    }
}

// running the machine

// set up registers, including free list
function initialize_machine(heapsize_words: number) {
    heap = new Heap(heapsize_words, builtins, constants)
    OS = []
    PC = 0
    RTS = []
    E = heap.allocate_Environment(0)
    E = heap.extend_Environment(heap.builtins_frame, E)
    E = heap.extend_Environment(heap.constants_frame, E)
    heap.set_machine(OS, E, RTS)
}

export function run(_instrs: unknown[], heapsize_words: number) {
    wc = 0
    instrs = _instrs
    initialize_machine(heapsize_words)
    // print_code()
    while (instrs[PC].tag !== 'DONE') {
        //heap.console.log()
        //console.log(PC, "PC: ")
        //console.log(instrs[PC].tag, "instr: ")
        // print_OS("\noperands:            ");
        //print_RTS("\nRTS:            ");
        const instr = instrs[PC++]
        //console.log(instrs[PC].tag, "next instruction: ")
        microcode[instr.tag](instr)
        //heap.console.log()
    }
    //console.log(OS, "\nfinal operands:           ")
    //print_OS()
    return heap.address_to_JS_value(peek(OS, 0))
}
