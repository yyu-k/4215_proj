import { Heap } from './heap'
import { Machine } from './machine'

const MUTEX_LOCKED = 1;
const MUTEX_UNLOCKED = 0;
const SUCCESS = true;
const FAILURE = false;

type BuiltinFunction = (machine: Machine, heap: Heap, ...args: unknown[]) => unknown

export const mutex_builtins: Record<string, BuiltinFunction> = {
    Mutex           : (machine, heap, _) => heap.allocate_Mutex(MUTEX_UNLOCKED),
    Lock            : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        const current_mutex_value = heap.get_Mutex_value(mutex_address);
                        if (current_mutex_value === MUTEX_UNLOCKED) {
                            heap.set_Mutex_value(mutex_address, MUTEX_LOCKED)
                            return SUCCESS
                        } else {
                            return FAILURE
                        }
                    },
    Unlock          : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        heap.set_Mutex_value(mutex_address, MUTEX_UNLOCKED)
                    },
    is_mutex        : (machine, heap, _) => heap.is_Mutex(machine.OS.pop()!) ? heap.values.True : heap.values.False,
}

export const waitGroup_builtins: Record<string, BuiltinFunction> = {
    WaitGroup       : (machine, heap, _) => heap.allocate_Mutex(MUTEX_UNLOCKED),
    Add             : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        const current_mutex_value = heap.get_Mutex_value(mutex_address);
                        heap.set_Mutex_value(mutex_address, current_mutex_value + 1);
                    },
    Done            : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        const current_mutex_value = heap.get_Mutex_value(mutex_address);
                        heap.set_Mutex_value(mutex_address, current_mutex_value - 1);
                    },
    Wait            : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        const current_mutex_value = heap.get_Mutex_value(mutex_address);
                        if (current_mutex_value === MUTEX_UNLOCKED) {
                            return SUCCESS;
                        } else {
                            return FAILURE;
                        }
                    },
    is_waitGroup    : (machine, heap, _) => heap.is_Mutex(machine.OS.pop()!) ? heap.values.True : heap.values.False,
}