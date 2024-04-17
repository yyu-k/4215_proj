import { builtins, constants, added_builtins } from "./builtins";
import { Heap } from "./heap";
import { Instruction, Machine } from "./machine";

const DEFAULT_TIMESLICE = 100;

export function run(
  instrs: Instruction[],
  heap_size: number,
  timeslice: number = DEFAULT_TIMESLICE,
  gc_flag: boolean = true,
) {
  const heap = new Heap(
    heap_size,
    builtins,
    added_builtins,
    constants,
    gc_flag,
  );
  const machines: Machine[] = [];
  const machine = new Machine(instrs, heap);
  machines.push(machine);

  let all_finished = false;
  let has_blocked_machines = false;
  let unblock_count = 0;
  while (!all_finished) {
    all_finished = true;

    outer: for (let i = 0; i < machines.length; i++) {
      const machine = machines[i];
      if (!machine.is_finished() && !machine.is_blocked()) {
        // keep running same machine even if it creates new machine
        while (true) {
          const result = machine.run(timeslice);
          if (result.new_machine instanceof Machine) {
            machines.push(result.new_machine);
          } else if (
            result.state.state === "failed_lock" ||
            result.state.state === "failed_wait"
          ) {
            // just switch to another machine
            continue outer;
          } else if (
            result.state.state === "blocked_send" ||
            result.state.state === "blocked_receive"
          ) {
            has_blocked_machines = true;
            break;
          } else {
            break;
          }
        }
        all_finished = false;
      }

      // stop running other machines once the main machine is finished
      if (machine.is_finished() && i === 0) {
        all_finished = true;
        break;
      }
    }

    if (has_blocked_machines) {
      // Throw an error if we've attempted to unblock machines multiple times without any success,
      // which usually indicates a deadlock.
      const should_error = unblock_count > 5 || all_finished;
      const made_progress = handle_blocked_machines(
        heap,
        machines,
        should_error,
      );
      if (made_progress) {
        unblock_count = 0;
      } else {
        unblock_count++;
      }
    }
  }

  return machines.map((machine) => machine.get_final_output());
}

function handle_blocked_machines(
  heap: Heap,
  machines: Machine[],
  should_error: boolean,
) {
  const blocked_send_machines = machines.filter(
    (machine) => machine.state.state === "blocked_send",
  );
  const blocked_receive_machines = machines.filter(
    (machine) => machine.state.state === "blocked_receive",
  );

  let unblocked_machines = 0;

  // Try to unblock machines which are directly blocked on each other
  outer: for (let i = 0; i < blocked_send_machines.length; i++) {
    const blocked_send_machine = blocked_send_machines[i];

    for (let j = 0; i < blocked_receive_machines.length; j++) {
      const blocked_receive_machine = blocked_receive_machines[j];

      // TODO: typescript doesn't narrow based on above filters
      if (blocked_send_machine.state.state !== "blocked_send") {
        throw new Error(
          "Trying to handle blocked channel send on a machine that is not blocked on a send",
        );
      }
      if (blocked_receive_machine.state.state !== "blocked_receive") {
        throw new Error(
          "Trying to handle blocked channel receive on a machine that is not blocked on a receive",
        );
      }

      if (
        blocked_send_machine.state.chan_address ===
        blocked_receive_machine.state.chan_address
      ) {
        blocked_receive_machine.OS.push(blocked_send_machine.state.value);
        blocked_receive_machine.state = { state: "default" };
        blocked_send_machine.state = { state: "default" };

        unblocked_machines++;
        blocked_send_machines.splice(i, 1);
        blocked_receive_machines.splice(j, 1);
        i--;
        continue outer;
      }
    }
  }

  for (let i = 0; i < blocked_send_machines.length; i++) {
    const blocked_send_machine = blocked_send_machines[i];

    // TODO: typescript doesn't narrow based on above filters
    if (blocked_send_machine.state.state !== "blocked_send") {
      throw new Error(
        "Trying to handle blocked channel send on a machine that is not blocked on a send",
      );
    }

    if (
      heap.push_Channel_item(
        blocked_send_machine.state.chan_address,
        blocked_send_machine.state.value,
      ).state === "success"
    ) {
      blocked_send_machine.state = { state: "default" };
      unblocked_machines++;
      blocked_send_machines.splice(i, 1);
      i--;
    }
  }

  for (let i = 0; i < blocked_receive_machines.length; i++) {
    const blocked_receive_machine = blocked_receive_machines[i];

    // TODO: typescript doesn't narrow based on above filters
    if (blocked_receive_machine.state.state !== "blocked_receive") {
      throw new Error(
        "Trying to handle blocked channel receive on a machine that is not blocked on a receive",
      );
    }

    const result = heap.pop_Channel_item(
      blocked_receive_machine.state.chan_address,
    );
    if (result.state === "success") {
      blocked_receive_machine.OS.push(result.value);
      blocked_receive_machine.state = { state: "default" };
      unblocked_machines++;
      blocked_receive_machines.splice(i, 1);
      i--;
    }
  }

  if (
    should_error &&
    (blocked_send_machines.length > 0 || blocked_receive_machines.length > 0) &&
    unblocked_machines === 0
  ) {
    if (
      blocked_send_machines.length > 0 &&
      blocked_receive_machines.length > 0
    ) {
      throw new Error(
        "Blocked on send and receive without matching opposing action",
      );
    }
    if (blocked_send_machines.length > 0) {
      throw new Error("Blocked on a send without any matching receive");
    }
    if (blocked_receive_machines.length > 0) {
      throw new Error("Blocked on a receive without any matching send");
    }
  }

  return unblocked_machines > 0;
}
