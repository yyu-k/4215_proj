import { Heap } from "./heap";
import {
  is_boolean,
  is_null,
  is_number,
  is_string,
  is_undefined,
  peek,
  push,
  word_to_string,
} from "./utilities";
import { builtin_array, builtin_id_to_arity, added_builtins } from "./builtins";
import { MUTEX_CONSTANTS } from "./added_builtins";

type MachineState =
  | { state: "default" }
  | { state: "errored"; error: unknown }
  | { state: "finished" }
  | { state: "failed_lock" }
  | { state: "failed_wait" }
  | { state: "blocked_send"; chan_address: number; value: number }
  | { state: "blocked_receive"; chan_address: number };

const JS_value_to_address = (heap: Heap, x: unknown) => {
  return is_boolean(x)
    ? x
      ? heap.values.True
      : heap.values.False
    : is_number(x)
      ? heap.allocate_Number(x as number)
      : is_string(x)
        ? heap.allocate_String(x as string)
        : is_undefined(x)
          ? heap.values.Undefined
          : is_null(x)
            ? heap.values.Null
            : "unknown word tag: " + word_to_string(x as number);
};

// **********************
// operators and builtins
// **********************/

const binop_microcode: Record<string, (x: unknown, y: unknown) => unknown> = {
  "+": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x + y;
    } else if (is_string(x) && is_string(y)) {
      return x + y;
    }
    throw new Error(
      `+ expects two numbers or two strings, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  "*": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x * y;
    }
    throw new Error(
      `* expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  "-": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x - y;
    }
    throw new Error(
      `binary - expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  "/": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x / y;
    }
    throw new Error(
      `/ expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  "%": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x % y;
    }
    throw new Error(
      `% expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  "<": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x < y;
    }
    throw new Error(
      `< expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  "<=": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x <= y;
    }
    throw new Error(
      `<= expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  ">=": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x >= y;
    }
    throw new Error(
      `>= expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  ">": (x, y) => {
    if (is_number(x) && is_number(y)) {
      return x > y;
    }
    throw new Error(
      `> expects two numbers, but got the following: ${JSON.stringify([x, y])}`,
    );
  },
  "==": (x, y) => x === y,
  "!=": (x, y) => x !== y,
};

// v2 is popped before v1
const apply_binop = (heap: Heap, op: string, v2: number, v1: number) => {
  return JS_value_to_address(
    heap,
    binop_microcode[op](
      heap.address_to_JS_value(v1),
      heap.address_to_JS_value(v2),
    ),
  );
};

const unop_microcode = {
  "-": (x: unknown) => {
    if (!is_number(x)) {
      throw new Error(`unary - expects a number, but got ${x}`);
    }
    return -x;
  },
  "!": (x: unknown) => {
    if (!is_boolean(x)) {
      throw new Error(`! expects a number, but got ${x}`);
    }
    return !x;
  },
};

const apply_unop = (heap: Heap, op: string, v: number) =>
  JS_value_to_address(heap, unop_microcode[op](heap.address_to_JS_value(v)));

const apply_builtin = (machine: Machine, heap: Heap, builtin_id: number) => {
  // console.log(builtin_id, "apply_builtin: builtin_id:")
  const result = builtin_array[builtin_id](machine, heap);
  // update_machine_state will set the result to heap.values.Undefined if the builtin executed
  // was a special operation which has a return value of specific meaning
  machine.OS.pop(); // pop fun
  push(machine.OS, result);
};

// *******
// machine
// *******

type Position = readonly [number, number];

export type Instruction =
  | { tag: "LDC"; val: unknown }
  | { tag: "LD"; sym: string; pos: Position }
  | { tag: "UNOP"; sym: string }
  | { tag: "BINOP"; sym: string }
  | { tag: "JOF"; addr: number }
  | { tag: "GOTO"; addr: number }
  // start should be used by continue, end by break. This instruction should cause a runtime stack push.
  | { tag: "WHILE_MARK"; start: number; end: number }
  | { tag: "EXIT_WHILE" }
  | { tag: "BREAK_CONT"; type: "continue" | "break" }
  | { tag: "POP" }
  | { tag: "CALL"; arity: number }
  | { tag: "TAIL_CALL"; arity: number }
  | { tag: "RESET" }
  | { tag: "SEND" }
  | { tag: "RECEIVE" }
  | { tag: "MUTEX"; type: "Lock" | "Unlock" }
  | { tag: "WAITGROUP"; type: "Add" | "Wait" | "Done" }
  | { tag: "GO"; arity: number }
  | { tag: "ASSIGN"; pos: Position }
  | { tag: "SLICE_CREATE"; init_size: number }
  | { tag: "CUT_SLICE" }
  | { tag: "SLICE_SET_ELEMENT" }
  | { tag: "SLICE_GET_ELEMENT" }
  | { tag: "LDF"; arity: number; addr: number }
  | { tag: "ENTER_SCOPE"; num: number }
  | { tag: "EXIT_SCOPE" }
  | { tag: "DONE" };

export type InstructionType<Tag extends Instruction["tag"]> = Extract<
  Instruction,
  { tag: Tag }
>;

type MicrocodeFunctionResult =
  | unknown
  | { type: "new_machine"; value: Machine };

type MicrocodeFunctions<Instructions extends { tag: string }> = {
  [E in Instructions as E["tag"]]: (
    machine: Machine,
    heap: Heap,
    instr: E,
  ) => MicrocodeFunctionResult;
};

type MachineRunResult = {
  state: MachineState;
  new_machines: Machine[];
  instructions_ran: number;
};

//array related helper functions
const make_array = (
  //this function expects the array size to be on top of the OS stack, followed by the initial assignments
  machine: Machine,
  heap: Heap,
  initial_assingment_size: number,
): [number, number] => {
  const size = heap.address_to_JS_value(machine.OS.pop()!);
  if (initial_assingment_size > size) {
    throw new Error(
      "Attempt to assign more values to array than the array size",
    );
  }
  const array_address = heap.allocate_Array(size);
  for (let i = 0; i < initial_assingment_size; i++) {
    heap.set_Array_element(
      array_address!,
      initial_assingment_size - i - 1,
      machine.OS.pop()!,
    );
  }
  return [array_address, size];
};

const microcode: MicrocodeFunctions<Instruction> = {
  LDC: (machine, heap, instr) =>
    push(machine.OS, JS_value_to_address(heap, instr.val)),
  UNOP: (machine, heap, instr) =>
    push(machine.OS, apply_unop(heap, instr.sym, machine.OS.pop()!)),
  BINOP: (machine, heap, instr) =>
    push(
      machine.OS,
      apply_binop(heap, instr.sym, machine.OS.pop()!, machine.OS.pop()!),
    ),
  POP: (machine, _heap, _instr) => machine.OS.pop(),
  JOF: (machine, heap, instr) =>
    (machine.PC = heap.is_True(machine.OS.pop()!) ? machine.PC : instr.addr),
  GOTO: (machine, _heap, instr) => (machine.PC = instr.addr),
  WHILE_MARK: (machine, heap, instr) => {
    push(
      machine.RTS,
      heap.allocate_Whileframe(machine.E, instr.start, instr.end),
    );
  },
  EXIT_WHILE: (machine, heap, instr) => {
    if (machine.RTS.length === 0) {
      throw new Error("Attempt to pop RTS with length 0 while exiting while");
    }
    const top_frame = machine.RTS.pop();
    if (!heap.is_Whileframe(top_frame!)) {
      throw new Error("Exited while loop when top frame is not a while frame");
    }
  },
  BREAK_CONT: (machine, heap, instr) => {
    // keep popping...
    if (machine.RTS.length === 0) {
      throw new Error(
        "Attempt to pop RTS with length 0 - break or continue is not within a while loop",
      );
    }
    const top_frame = machine.RTS.pop()!;
    if (heap.is_Callframe(top_frame)) {
      throw new Error("Attempt to break or continue within function");
    }
    if (heap.is_Whileframe(top_frame)) {
      // ...until top frame is a while frame
      if (instr.type === "continue") {
        machine.PC = heap.get_Whileframe_start(top_frame);
        machine.E = heap.get_Whileframe_environment(top_frame); //restore environment
      } else if (instr.type === "break") {
        machine.PC = heap.get_Whileframe_end(top_frame);
        machine.E = heap.get_Whileframe_environment(top_frame);
      } else {
        throw new Error("Unrecognised instruction type for BREAK_CONT");
      }
      //push back the whileframe
      push(machine.RTS, top_frame);
    } else {
      machine.PC--;
    }
  },
  ENTER_SCOPE: (machine, heap, instr) => {
    push(machine.RTS, heap.allocate_Blockframe(machine.E));
    const frame_address = heap.allocate_Frame(instr.num);
    // AMENDED
    push(machine.RTS, frame_address); //prevent frame_address from getting deallocated when extending environment
    machine.E = heap.extend_Environment(frame_address, machine.E);
    machine.RTS.pop(); //pop frame_address
    for (let i = 0; i < instr.num; i++) {
      heap.set_child(frame_address, i, heap.values.Unassigned);
    }
  },
  EXIT_SCOPE: (machine, heap, _instr) =>
    (machine.E = heap.get_Blockframe_environment(machine.RTS.pop()!)),
  LD: (machine, heap, instr) => {
    const val = heap.get_Environment_value(machine.E, instr.pos);
    if (heap.is_Unassigned(val))
      throw new Error("access of unassigned variable");
    push(machine.OS, val);
  },
  ASSIGN: (machine, heap, instr) =>
    heap.set_Environment_value(machine.E, instr.pos, peek(machine.OS, 0)),
  SLICE_CREATE: (machine, heap, instr) => {
    const [array_addresss, size] = make_array(machine, heap, instr.init_size);
    const slice_address = heap.allocate_Slice(array_addresss, 0, size);
    machine.OS.push(slice_address);
  },
  CUT_SLICE: (machine, heap, instr) => {
    let new_max_index = heap.address_to_JS_value(machine.OS.pop()!);
    let new_end_index = heap.address_to_JS_value(machine.OS.pop()!);
    let new_start_index = heap.address_to_JS_value(machine.OS.pop()!);
    const old_slice = machine.OS.pop()!;
    if (!heap.is_Slice(old_slice)) {
      throw new Error("Attempt to cut an object which is not a Slice");
    }
    //The default is zero for the low bound and the length of the slice for the high bound.
    if (new_start_index === null) {
      new_start_index = 0;
    }
    if (new_start_index < 0) {
      throw new Error("Attempt to slice with a <0 starting index");
    }
    const old_start_index = heap.get_Slice_start_index(old_slice);
    const old_capacity = heap.get_Slice_capacity(old_slice);
    const array_address = heap.get_Slice_array_address(old_slice);
    const array_size = heap.get_Array_size(array_address);
    //if old is 2 and new is 1, then new is now 3
    new_start_index = old_start_index + new_start_index;
    if (new_end_index === null) {
      //if end is not defined, take the maximum possible, which is the end of the old slice
      new_end_index = heap.get_Slice_end_index(old_slice);
    } else {
      //if end index is 5 and old start is 3, new end is now 8
      new_end_index = old_start_index + new_end_index;
    }
    if (new_end_index > array_size) {
      throw new Error(
        "Attempt to cut a slice beyond the original slice's limit",
      );
    }
    if (new_end_index - new_start_index > old_capacity) {
      throw new Error("Capacity of slice exceeded based on index");
    }
    const new_slice = heap.allocate_Slice(
      array_address,
      new_start_index,
      new_end_index,
    );
    machine.OS.push(new_slice);
  },
  SLICE_SET_ELEMENT: (machine, heap, _instr) => {
    const slice_index = heap.address_to_JS_value(machine.OS.pop()!);
    const slice_address = machine.OS.pop()!;
    const value = peek(machine.OS, 0);
    if (!heap.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to set slice element of an object which is not a slice",
      );
    }
    heap.set_Slice_element(slice_address, slice_index, value);
  },
  SLICE_GET_ELEMENT: (machine, heap, _instr) => {
    const slice_index = heap.address_to_JS_value(machine.OS.pop()!);
    const slice_address = machine.OS.pop()!;
    if (!heap.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to get slice element of an object which is not a slice",
      );
    }
    push(machine.OS, heap.get_Slice_element(slice_address, slice_index));
  },
  LDF: (machine, heap, instr) => {
    const closure_address = heap.allocate_Closure(
      instr.arity,
      instr.addr,
      machine.E,
    );
    push(machine.OS, closure_address);
  },
  CALL: (machine, heap, instr) => {
    const arity = instr.arity;
    const fun = peek(machine.OS, arity);
    if (heap.is_Builtin(fun)) {
      const builtin_arity = builtin_id_to_arity[heap.get_Builtin_id(fun)];
      if (builtin_arity !== arity) {
        throw new Error(
          "Mismatch in arity between number of called arguments and number of arguments in Closure",
        );
      }
      return apply_builtin(machine, heap, heap.get_Builtin_id(fun));
    }
    if (!heap.is_Closure(fun)) {
      throw new Error("Attempt to call a non-closure");
    }
    const closure_arity = heap.get_Closure_arity(fun);
    if (closure_arity !== arity) {
      throw new Error(
        "Mismatch in arity between number of called arguments and number of arguments in Closure",
      );
    }
    const new_PC = heap.get_Closure_pc(fun);
    const new_frame = heap.allocate_Frame(arity);
    for (let i = arity - 1; i >= 0; i--) {
      heap.set_child(new_frame, i, machine.OS.pop()!);
    }
    machine.OS.pop(); // pop fun
    //AMENDED
    //need to make sure that new_frame does not get deallocated before CALL exits
    //since new_frame is not currently referenced anywhere
    push(machine.RTS, new_frame); //prevent new_frame from getting deallocated when allocating Callframe
    const callframe_address = heap.allocate_Callframe(machine.E, machine.PC);
    machine.RTS.pop(); //remove new_frame from RTS
    push(machine.RTS, callframe_address);
    push(machine.RTS, new_frame); //prevent new_frame from getting deallocated when extending environment
    machine.E = heap.extend_Environment(
      new_frame,
      heap.get_Closure_environment(fun),
    );
    machine.RTS.pop(); //remove new_frame from RTS
    machine.PC = new_PC;
  },
  GO: (machine, heap, instr) => {
    const arity = instr.arity;
    const fun = peek(machine.OS, arity);

    // Create new machine for `go` statement
    const new_machine = new Machine(machine.instrs, heap);

    // For builtins, we don't need to create a separate call frame
    if (heap.is_Builtin(fun)) {
      const builtin_arity = builtin_id_to_arity[heap.get_Builtin_id(fun)];
      if (builtin_arity !== arity) {
        throw new Error(
          "Mismatch in arity between number of called arguments and number of arguments in Closure",
        );
      }
      // Shift function and arguments to new machine's operand stack
      new_machine.OS = machine.OS.slice(-arity);
      machine.OS = machine.OS.slice(0, -1 - arity);
      apply_builtin(new_machine, heap, heap.get_Builtin_id(fun));
      new_machine.PC = new_machine.instrs.length - 1;
      new_machine.state = { state: "finished" };
      machine.OS.push(heap.values.Undefined);
    } else {
      if (!heap.is_Closure(fun)) {
        throw new Error("Attempt to call a non-closure");
      }
      const closure_arity = heap.get_Closure_arity(fun);
      if (closure_arity !== arity) {
        throw new Error(
          "Mismatch in arity between number of called arguments and number of arguments in Closure",
        );
      }
      const new_PC = heap.get_Closure_pc(fun);
      const new_frame = heap.allocate_Frame(arity);
      for (let i = arity - 1; i >= 0; i--) {
        heap.set_child(new_frame, i, machine.OS.pop()!);
      }
      machine.OS.pop(); // pop fun

      //need to make sure that new_frame does not get deallocated before GO exits
      //since new_frame is not currently referenced anywhere
      push(new_machine.RTS, new_frame); //prevent new_frame from getting deallocated when allocating Callframe
      const callframe_address = heap.allocate_Callframe(
        // copy current environment
        machine.E,
        // set PC to DONE after returning from "function call"
        machine.instrs.length - 1,
      );
      new_machine.RTS.pop(); //remove new_frame from RTS
      push(new_machine.RTS, callframe_address);
      push(new_machine.RTS, new_frame); //prevent new_frame from getting deallocated when extending environment
      new_machine.E = heap.extend_Environment(
        new_frame,
        heap.get_Closure_environment(fun),
      );
      new_machine.RTS.pop(); //remove new_frame from RTS
      new_machine.PC = new_PC;
      machine.OS.push(heap.values.Undefined);
    }
    return { type: "new_machine", value: new_machine };
  },
  TAIL_CALL: (machine, heap, instr) => {
    const arity = instr.arity;
    const fun = peek(machine.OS, arity);
    if (heap.is_Builtin(fun)) {
      return apply_builtin(machine, heap, heap.get_Builtin_id(fun));
    }
    const new_PC = heap.get_Closure_pc(fun);
    const new_frame = heap.allocate_Frame(arity);
    for (let i = arity - 1; i >= 0; i--) {
      heap.set_child(new_frame, i, machine.OS.pop()!);
    }
    machine.OS.pop(); // pop fun
    // AMENDED
    push(machine.RTS, new_frame); //prevent new_frame from getting deallocated when extending environment
    // don't push on RTS here
    machine.E = heap.extend_Environment(
      new_frame,
      heap.get_Closure_environment(fun),
    );
    machine.RTS.pop(); //remove new_frame from RTS
    machine.PC = new_PC;
  },
  RESET: (machine, heap, _instr) => {
    // keep popping...
    const top_frame = machine.RTS.pop()!;
    if (heap.is_Callframe(top_frame)) {
      // ...until top frame is a call frame
      machine.PC = heap.get_Callframe_pc(top_frame);
      machine.E = heap.get_Callframe_environment(top_frame);
    } else {
      machine.PC--;
    }
  },
  SEND: (machine, heap, _instr) => {
    const value = machine.OS.pop()!;
    const chan_address = machine.OS.pop()!;
    if (!heap.is_Channel(chan_address)) {
      throw new Error("Attempt to send to a non-channel");
    }
    if (heap.push_Channel_item(chan_address, value).state === "failed") {
      machine.state = { state: "blocked_send", chan_address, value };
    }
  },
  RECEIVE: (machine, heap, _instr) => {
    const chan_address = machine.OS.pop()!;
    if (!heap.is_Channel(chan_address)) {
      throw new Error("Attempt to receive from a non-channel");
    }
    const result = heap.pop_Channel_item(chan_address);
    if (result.state === "failed") {
      machine.state = { state: "blocked_receive", chan_address };
    } else {
      push(machine.OS, result.value);
    }
  },
  MUTEX: (machine, heap, instr) => {
    machine.state = { state: "default" }; //reset the state
    const mutex_address = peek(machine.OS, 0);
    if (!heap.is_Mutex(mutex_address)) {
      throw new Error(
        "Mutex operation attempted when mutex addresss is not on top of OS",
      );
    }
    if (instr.type === "Lock") {
      const current_mutex_value = heap.get_Mutex_value(mutex_address);
      if (current_mutex_value === MUTEX_CONSTANTS.MUTEX_UNLOCKED) {
        heap.set_Mutex_value(mutex_address, MUTEX_CONSTANTS.MUTEX_LOCKED);
        machine.OS.pop(); //consume the mutex address
        push(machine.OS, heap.values.null);
      } else {
        machine.state = { state: "failed_lock" };
        //mutex address not consumed because busy wait will occur
      }
      //LOCK always return null, which gets popped in a sequence
    } else if (instr.type === "Unlock") {
      heap.set_Mutex_value(mutex_address, MUTEX_CONSTANTS.MUTEX_UNLOCKED);
      machine.OS.pop(); //consume the mutex address
      //UNLOCK always return null, which gets popped in a sequence
      push(machine.OS, heap.values.null);
    } else {
      throw new Error("Unknown type for MUTEX bytecode");
    }
  },
  WAITGROUP: (machine, heap, instr) => {
    machine.state = { state: "default" }; //reset the state
    const waitgroup_address = peek(machine.OS, 0);
    if (!heap.is_Waitgroup(waitgroup_address))
      throw new Error(
        "Waitgroup operation attempted when waitgroup addresss is not on top of OS",
      );
    if (instr.type === "Add") {
      const current_waitgroup_value =
        heap.get_Waitgroup_value(waitgroup_address);
      heap.set_Waitgroup_value(waitgroup_address, current_waitgroup_value + 1);
      machine.OS.pop(); //consume the waitgroup address
      push(machine.OS, heap.values.null);
    } else if (instr.type === "Done") {
      const current_waitgroup_value =
        heap.get_Waitgroup_value(waitgroup_address);
      heap.set_Waitgroup_value(waitgroup_address, current_waitgroup_value - 1);
      machine.OS.pop(); //consume the waitgroup address
      push(machine.OS, heap.values.null);
    } else if (instr.type === "Wait") {
      const current_waitgroup_value =
        heap.get_Waitgroup_value(waitgroup_address);
      if (current_waitgroup_value === MUTEX_CONSTANTS.MUTEX_UNLOCKED) {
        machine.OS.pop(); //consume the waitgroup address
        push(machine.OS, heap.values.null);
      } else {
        machine.state = { state: "failed_wait" };
      }
    } else {
      throw new Error("Unknown type for WAITGROUP bytecode");
    }
  },
  DONE: () => {},
};

export class Machine {
  instrs: Instruction[];
  // machine registers
  OS: number[]; // JS array (stack) of words (Addresses, word-encoded literals, numbers)
  PC: number; // JS number
  E: number; // heap Address
  RTS: number[]; // JS array (stack) of Addresses
  state: MachineState; //used for concurrency
  output: any[];
  heap: Heap;

  constructor(instrs: Instruction[], heap: Heap) {
    this.instrs = instrs;
    this.OS = [];
    this.PC = 0;
    this.RTS = [];
    this.state = { state: "default" };
    this.output = [];

    this.E = heap.allocate_Environment(0);
    this.E = heap.extend_Environment(heap.builtins_frame, this.E);
    this.E = heap.extend_Environment(heap.added_builtins_frame, this.E);
    this.E = heap.extend_Environment(heap.constants_frame, this.E);

    this.heap = heap;
    heap.add_machine(this);
  }

  is_finished() {
    return this.state.state === "finished" || this.state.state === "errored";
  }

  is_blocked() {
    return (
      this.state.state === "blocked_send" ||
      this.state.state === "blocked_receive"
    );
  }

  run(num_instructions: number): MachineRunResult {
    let instructions_ran = 0;
    let new_machines: Machine[] = [];

    // Machines cannot progress on blocked send/receive for unbuffered channels.
    // This is handled in the scheduler.
    if (this.is_finished() || this.is_blocked()) {
      return { state: this.state, instructions_ran, new_machines };
    }

    while (
      instructions_ran < num_instructions &&
      this.instrs[this.PC].tag !== "DONE"
    ) {
      try {
        const instr = this.instrs[this.PC++];
        const result = (
          microcode[instr.tag] as (
            machine: Machine,
            heap: Heap,
            instr: Instruction,
          ) => void | MicrocodeFunctionResult
        )(this, this.heap, instr);
        instructions_ran++;

        // Workaround since TS narrows `this.state` to exclude `blocked_send/receive` after
        // the check above, but they could be modified by the microcode functions.
        const current_state: MachineState = this.state as MachineState;

        if (current_state.state === "failed_lock") {
          this.PC -= 1; //move back to LOCK instruction
          const instr = this.instrs[this.PC];
          if (instr.tag !== "MUTEX" || instr.type !== "Lock") {
            throw Error(
              "Failed to find LOCK instruction after Failed Lock Signal triggered",
            );
          }
          return { state: this.state, instructions_ran, new_machines };
        } else if (current_state.state === "failed_wait") {
          this.PC -= 1; //move back to the Wait instruction
          const instr = this.instrs[this.PC];
          if (instr.tag !== "WAITGROUP" || instr.type !== "Wait") {
            throw Error(
              "Failed to find WAIT instruction after Failed Wait Signal triggered",
            );
          }
          //The outcome of FAILED_WAIT_SIGNAL is identical to FAILED_LOCK_SIGNAL
          return { state: this.state, instructions_ran, new_machines };
        } else if (
          current_state.state === "blocked_send" ||
          current_state.state === "blocked_receive"
        ) {
          return { state: this.state, instructions_ran, new_machines };
        } else if (
          typeof result === "object" &&
          result != null &&
          "type" in result &&
          "value" in result &&
          result.type === "new_machine" &&
          result.value instanceof Machine
        ) {
          new_machines.push(result.value);
        }
      } catch (error) {
        this.state = { state: "errored", error };
        return { state: this.state, instructions_ran, new_machines };
      }
    }

    if (this.instrs[this.PC].tag === "DONE") {
      this.state = { state: "finished" };
    }
    return { state: this.state, instructions_ran, new_machines };
  }

  get_final_output() {
    return {
      state: this.state,
      output: this.output,
      final_value:
        this.state.state === "finished"
          ? this.heap.address_to_JS_value(peek(this.OS, 0))
          : null,
    };
  }
}
