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
    let has_blocked_machines = false
    while (!all_finished) {
        all_finished = true

        outer:
        for (let i = 0; i < machines.length; i++) {
            const machine = machines[i]
            if (!machine.is_finished() && !machine.is_blocked()) {
                // keep running same machine even if it creates new machine
                while (true) {
                    const result = machine.run(timeslice)
                    if (result.new_machine instanceof Machine) {
                        machines.push(result.new_machine)
                    } else if (result.state.state === "failed_lock" || result.state.state === "failed_wait") {
                        //just switch to another machine
                        continue outer
                    } else if (result.state.state === "blocked_send" || result.state.state === "blocked_receive") {
                        has_blocked_machines = true
                        break
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

        if (has_blocked_machines) {
            handle_blocked_machines(machines)
        }
    }

    return machines.map(machine => machine.get_final_output())
}

function handle_blocked_machines(machines: Machine[]) {
    const blocked_send_machines = machines.filter(machine => machine.state.state === "blocked_send")
    const blocked_receive_machines = machines.filter(machine => machine.state.state === "blocked_receive")

    let unblocked_machines = 0

    outer:
    for (let i = 0; i < blocked_send_machines.length; i++) {
        const blocked_send_machine = blocked_send_machines[i]

        for (let j = 0; i < blocked_receive_machines.length; j++) {
            const blocked_receive_machine = blocked_receive_machines[j]

            // TODO: typescript doesn't narrow based on above filters
            if (blocked_send_machine.state.state !== "blocked_send") {
                throw new Error("Trying to handle blocked channel send on a machine that is not blocked on a send")
            }
            if (blocked_receive_machine.state.state !== "blocked_receive") {
                throw new Error("Trying to handle blocked channel receive on a machine that is not blocked on a receive")
            }

            if (blocked_send_machine.state.chan_address === blocked_receive_machine.state.chan_address) {
                blocked_receive_machine.OS.push(blocked_send_machine.state.value)
                blocked_receive_machine.state = { state: "default" }
                blocked_send_machine.state = { state: "default" }

                unblocked_machines++
                blocked_send_machines.splice(i, 1)
                blocked_receive_machines.splice(j, 1)
                i--
                continue outer
            }
        }
    }

    if ((blocked_send_machines.length > 0 || blocked_receive_machines.length > 0) && unblocked_machines === 0) {
        if (blocked_send_machines.length > 0 && blocked_receive_machines.length > 0) {
            throw Error("Blocked on send and receive without matching opposing action")
        }
        if (blocked_send_machines.length > 0) {
            throw Error("Blocked on a send without any matching receive")
        }
        if (blocked_receive_machines.length > 0) {
            throw Error("Blocked on a receive without any matching send")
        }
    }
}
