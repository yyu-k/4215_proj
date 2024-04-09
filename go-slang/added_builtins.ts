import { Heap } from './heap'
import { Machine } from './machine'

export const MUTEX_CONSTANTS = {
    MUTEX_LOCKED : 1,
    MUTEX_UNLOCKED : 0,
    MUTEX_SUCCESS : true,
    MUTEX_FAILURE : false,
}

type BuiltinFunction = (machine: Machine, heap: Heap, ...args: unknown[]) => unknown

export const mutex_builtins: Record<string, BuiltinFunction> = {
    Mutex           : (machine, heap) => heap.allocate_Mutex(MUTEX_CONSTANTS.MUTEX_UNLOCKED),
    Lock            : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        const current_mutex_value = heap.get_Mutex_value(mutex_address);
                        if (current_mutex_value === MUTEX_CONSTANTS.MUTEX_UNLOCKED) {
                            heap.set_Mutex_value(mutex_address, MUTEX_CONSTANTS.MUTEX_LOCKED)
                            return MUTEX_CONSTANTS.MUTEX_SUCCESS
                        } else {
                            return MUTEX_CONSTANTS.MUTEX_FAILURE
                        }
                    },
    Unlock          : (machine, heap, _mutex_address) => {
                        const mutex_address = machine.OS.pop()!;
                        heap.set_Mutex_value(mutex_address, MUTEX_CONSTANTS.MUTEX_UNLOCKED)
                    },
    is_mutex        : (machine, heap, _) => heap.is_Mutex(machine.OS.pop()!) ? heap.values.True : heap.values.False,
}

export const waitGroup_builtins: Record<string, BuiltinFunction> = {
    WaitGroup       : (machine, heap) => heap.allocate_Mutex(MUTEX_CONSTANTS.MUTEX_UNLOCKED),
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
                        if (current_mutex_value === MUTEX_CONSTANTS.MUTEX_UNLOCKED) {
                            return MUTEX_CONSTANTS.MUTEX_SUCCESS;
                        } else {
                            return MUTEX_CONSTANTS.MUTEX_FAILURE;
                        }
                    },
    is_waitGroup    : (machine, heap, _) => heap.is_Mutex(machine.OS.pop()!) ? heap.values.True : heap.values.False,
}

export const array_builtins: Record<string, BuiltinFunction> = {
    Array          : (machine, heap, _size) => {
                        const size = machine.OS.pop()!
                        return heap.allocate_Array(size);
                    },
    get_Array_element : (machine, heap, _address, _index) => {
                        const index = machine.OS.pop()!
                        const address = machine.OS.pop()!
                        return heap.get_Array_element(address, index)
                    },
    set_Array_element : (machine, heap, _address, _index, _value) => {
                        const value = machine.OS.pop()!
                        const index = machine.OS.pop()!
                        const address = machine.OS.pop()!
                        heap.set_Array_element(address, index, value)
                    },
    is_Array    : (machine, heap, _) => heap.is_Array(machine.OS.pop()!) ? heap.values.True : heap.values.False,
}