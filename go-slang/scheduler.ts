import { builtins, constants } from "./builtins"
import { Heap } from "./heap"
import { Machine } from "./machine"

const DEFAULT_TIMESLICE = 100;

export function run(instrs: any[], heap_size: number, timeslice : number = DEFAULT_TIMESLICE) {
    const heap = new Heap(heap_size, builtins, constants)
    const machines: Machine[] = []
    const machine = new Machine(instrs, heap)
    machines.push(machine)

    let all_finished = false
    while (!all_finished) {
        all_finished = true

        // TODO: for consistency with go, once we implement concurrent features,
        // we should stop running other machines once the main machine is finished
        for (let i = 0; i < machines.length; i++) {
            const machine = machines[i]
            if (!machine.is_finished()) {
                const result = machine.run(timeslice)
                if (typeof result === "object" && result.type === "machine") {
                    machines.push(result.machine)
                }
                all_finished = false
            }
        }
    }

    return machines.map(machine => machine.get_final_output())
}
