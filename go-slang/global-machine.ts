import { builtins, constants } from "./builtins"
import { Heap } from "./heap"
import { Machine } from "./machine"

export function run(instrs: any[], heap_size: number) {
    const heap = new Heap(heap_size, builtins, constants)
    // TODO: allow for creation of new machines and time-slicing
    const machine = new Machine(instrs, heap)

    return machine.run()
}
