import { Heap } from './heap'
import { error, peek, push, word_to_string } from './utilities'
import { builtin_array } from './builtins'

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

const apply_unop = (heap: Heap, op: string, v: number) =>
    JS_value_to_address(heap, unop_microcode[op](heap.address_to_JS_value(v)))

const apply_builtin = (machine: Machine, heap: Heap, builtin_id: number) => {
    // console.log(builtin_id, "apply_builtin: builtin_id:")
    const result = builtin_array[builtin_id](machine, heap)
    machine.OS.pop() // pop fun
    push(machine.OS, result)
}

// *******
// machine
// *******

const microcode: Record<string, (machine: Machine, heap: Heap, instr: any) => unknown> = {
LDC:
    (machine, heap, instr) =>
    push(machine.OS, JS_value_to_address(heap, instr.val)),
UNOP:
    (machine, heap, instr) =>
    push(machine.OS, apply_unop(heap, instr.sym, machine.OS.pop()!)),
BINOP:
    (machine, heap, instr) =>
    push(machine.OS,
         apply_binop(heap, instr.sym, machine.OS.pop()!, machine.OS.pop()!)),
POP:
    (machine, heap, instr) =>
    machine.OS.pop(),
JOF:
    (machine, heap, instr) =>
    machine.PC = heap.is_True(machine.OS.pop()!) ? machine.PC : instr.addr,
GOTO:
    (machine, heap, instr) =>
    machine.PC = instr.addr,
ENTER_SCOPE:
    (machine, heap, instr) => {
        push(machine.RTS, heap.allocate_Blockframe(machine.E))
        const frame_address = heap.allocate_Frame(instr.num)
        // AMENDED
        push(machine.RTS, frame_address); //prevent frame_address from getting deallocated when extending environment
        machine.E = heap.extend_Environment(frame_address, machine.E)
        machine.RTS.pop(); //pop frame_address
        for (let i = 0; i < instr.num; i++) {
            heap.set_child(frame_address, i, heap.values.Unassigned)
        }
    },
EXIT_SCOPE:
    (machine, heap, instr) =>
    machine.E = heap.get_Blockframe_environment(machine.RTS.pop()!),
LD:
    (machine, heap, instr) => {
        const val = heap.get_Environment_value(machine.E, instr.pos)
        if (heap.is_Unassigned(val))
            error("access of unassigned variable")
        push(machine.OS, val)
    },
ASSIGN:
    (machine, heap, instr) =>
    heap.set_Environment_value(machine.E, instr.pos, peek(machine.OS,0)),
LDF:
    (machine, heap, instr) => {
        const closure_address =
                  heap.allocate_Closure(
                      instr.arity, instr.addr, machine.E)
        push(machine.OS, closure_address)
    },
CALL:
    (machine, heap, instr) => {
        const arity = instr.arity
        const fun = peek(machine.OS, arity)
        if (heap.is_Builtin(fun)) {
            return apply_builtin(machine, heap, heap.get_Builtin_id(fun))
        }
        const new_PC = heap.get_Closure_pc(fun)
        const new_frame = heap.allocate_Frame(arity)
        for (let i = arity - 1; i >= 0; i--) {
            heap.set_child(new_frame, i, machine.OS.pop()!)
        }
        machine.OS.pop() // pop fun
        //AMENDED
        //need to make sure that new_frame does not get deallocated before CALL exits
        //since new_frame is not currently referenced anywhere
        push(machine.RTS, new_frame); //prevent new_frame from getting deallocated when allocating Callframe
        const callframe_address = heap.allocate_Callframe(machine.E, machine.PC)
        machine.RTS.pop(); //remove new_frame from RTS
        push(machine.RTS, callframe_address);
        push(machine.RTS, new_frame); //prevent new_frame from getting deallocated when extending environment
        machine.E = heap.extend_Environment(
                new_frame,
                heap.get_Closure_environment(fun))
        machine.RTS.pop(); //remove new_frame from RTS
        machine.PC = new_PC
    },
TAIL_CALL:
    (machine, heap, instr) => {
        const arity = instr.arity
        const fun = peek(machine.OS, arity)
        if (heap.is_Builtin(fun)) {
            return apply_builtin(machine, heap, heap.get_Builtin_id(fun))
        }
        const new_PC = heap.get_Closure_pc(fun)
        const new_frame = heap.allocate_Frame(arity)
        for (let i = arity - 1; i >= 0; i--) {
            heap.set_child(new_frame, i, machine.OS.pop()!)
        }
        machine.OS.pop() // pop fun
        // AMENDED
        push(machine.RTS, new_frame); //prevent new_frame from getting deallocated when extending environment
        // don't push on RTS here
        machine.E = heap.extend_Environment(
                new_frame,
                heap.get_Closure_environment(fun))
        machine.RTS.pop(); //remove new_frame from RTS
        machine.PC = new_PC
    },
RESET:
    (machine, heap, instr) => {
        // keep popping...
        const top_frame = machine.RTS.pop()!
        if (heap.is_Callframe(top_frame)) {
            // ...until top frame is a call frame
            machine.PC = heap.get_Callframe_pc(top_frame)
            machine.E = heap.get_Callframe_environment(top_frame)
        } else {
	    machine.PC--
        }
    }
}

export class Machine {
    instrs: any[]
    // machine registers
    OS: number[]   // JS array (stack) of words (Addresses, word-encoded literals, numbers)
    PC: number     // JS number
    E: number      // heap Address
    RTS: number[]  // JS array (stack) of Addresses
    output: any[]
    // TODO: Remove this global heap
    heap: Heap

    constructor(instrs: any[], heap: Heap) {
        this.instrs = instrs
        this.OS = []
        this.PC = 0
        this.RTS = []

        this.output = []

        this.E = heap.allocate_Environment(0)
        this.E = heap.extend_Environment(heap.builtins_frame, this.E)
        this.E = heap.extend_Environment(heap.constants_frame, this.E)

        this.heap = heap
    }

    run() {
        this.heap.add_machine(this)

        while (this.instrs[this.PC].tag !== 'DONE') {
            //heap.console.log()
            //console.log(PC, "PC: ")
            //console.log(instrs[PC].tag, "instr: ")
            // print_OS("\noperands:            ");
            //print_RTS("\nRTS:            ");
            const instr = this.instrs[this.PC++]
            //console.log(instrs[PC].tag, "next instruction: ")
            microcode[instr.tag](this, this.heap, instr)
            //heap.console.log()
        }
        //console.log(OS, "\nfinal operands:           ")
        //print_OS()
        return [this.output, this.heap.address_to_JS_value(peek(this.OS, 0))]
    }
}
