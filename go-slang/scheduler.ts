import { builtins, constants } from "./builtins"
import { Heap } from "./heap"
import { Instruction, Machine } from "./machine"

const DEFAULT_TIMESLICE = 100;

export function run(instrs: Instruction[], heap_size: number, timeslice : number = DEFAULT_TIMESLICE) {
    const heap = new Heap(heap_size, builtins, constants)
    const machines: Machine[] = []
    const machine = new Machine(instrs, heap)
    machines.push(machine)

    let all_finished = false
    while (!all_finished) {
        all_finished = true

        outer:
        for (let i = 0; i < machines.length; i++) {
            const machine = machines[i]
            if (!machine.is_finished()) {
                // keep running same machine even if it creates new machine
                while (true) {
                    const result = machine.run(timeslice)
                    if (result.new_machine instanceof Machine) {
                        machines.push(result.new_machine)
                    } else if (result.state.state === "failed_lock" || result.state.state === "failed_wait") {
                        //just switch to another machine
                        continue outer
                    } else {
                        break
                    }
                }
                all_finished = false
            }

            // stop running other machines once the main machine is finished
            if (machine.is_finished() && i === 0) {
                all_finished = true
                break
            }
        }
    }

    return machines.map(machine => machine.get_final_output())
}
