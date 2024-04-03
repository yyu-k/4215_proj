import { Heap } from './heap'
import { Machine } from './machine'

const MUTEX_LOCKED = 0;
const MUTEX_UNLOCKED = 1;
const SUCCESS = true;
const FAILURE = false;

type BuiltinFunction = (machine: Machine, heap: Heap, ...args: unknown[]) => unknown

export const mutex_builtins: Record<string, BuiltinFunction> = {
    Mutex         : (machine, heap, _) => heap.allocate_Mutex(1),
    Lock          : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        const current_mutex_value = heap.get_Mutex_value(mutex_address);
                        if (current_mutex_value === MUTEX_UNLOCKED) {
                            heap.set_Mutex_value(mutex_address, MUTEX_LOCKED)
                            return SUCCESS
                        } else {
                            return FAILURE
                        }
                    },
    Unlock        : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        const current_mutex_value = heap.get_Mutex_value(mutex_address);
                        if (current_mutex_value === MUTEX_UNLOCKED) {
                            return SUCCESS
                        } else if (current_mutex_value === MUTEX_LOCKED) {
                            heap.set_Mutex_value(mutex_address, MUTEX_UNLOCKED)
                            return SUCCESS
                        } else {
                            throw TypeError("Mutex value not 1 or 0")
                        }
                    },
    is_mutex      : (machine, heap, _) => heap.is_Mutex(machine.OS.pop()!) ? heap.values.True : heap.values.False,
}