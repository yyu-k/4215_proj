import { InitializeHook } from 'module'
import { Heap } from './heap'
import { Machine } from './machine'
import { error } from './utilities'

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

const make_array = (machine, heap, _size, _initial_assingment_size) : [number, number] => {
    //Note that the true arity of this function (number of OS.pop) is a variable
    const initial_assingment_size = heap.address_to_JS_value(machine.OS.pop()!)
    const size = heap.address_to_JS_value(machine.OS.pop()!)
    if (initial_assingment_size > size) {
        error('Attempt to assign more values to array than the array size')
    }
    const heap_address = heap.allocate_Array(size)
    //dark magic here - the other alternative is not to check arity
    const array_builtin = machine.OS.pop()
    for (let i = 0; i < initial_assingment_size; i++) {
        heap.set_Array_element(heap_address!, initial_assingment_size - i - 1, machine.OS.pop()!)
    }
    //restore the popped function
    machine.OS.push(array_builtin!);
    return [heap_address, size]
}
export const array_builtins: Record<string, BuiltinFunction> = {
    Slice          : (machine, heap, _size, _initial_assingment_size) => {
                        const [heap_address, size] = make_array(machine, heap, _size, _initial_assingment_size)
                        const slice_address = heap.allocate_Slice(heap_address, 0, size)
                        return slice_address
                    },
    get_Slice_element : (machine, heap, _address, _index) => {
                        const slice_index = heap.address_to_JS_value(machine.OS.pop()!)
                        const slice_address = machine.OS.pop()!
                        return heap.get_Slice_element(slice_address, slice_index)
                    },
    set_Slice_element : (machine, heap, _address, _index, _value) => {
                        const value = machine.OS.pop()!
                        const slice_index = heap.address_to_JS_value(machine.OS.pop()!)
                        const slice_address = machine.OS.pop()!
                        heap.set_Slice_element(slice_address, slice_index, value)
                    },
    //The answer should always be false
    is_Array    : (machine, heap, _) => heap.is_Array(machine.OS.pop()!) ? heap.values.True : heap.values.False,
    is_Slice    : (machine, heap, _) => heap.is_Slice(machine.OS.pop()!) ? heap.values.True : heap.values.False
}