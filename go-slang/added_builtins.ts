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
    const array_address = heap.allocate_Array(size)
    //dark magic here - the other alternative is not to check arity
    const array_builtin = machine.OS.pop()
    for (let i = 0; i < initial_assingment_size; i++) {
        heap.set_Array_element(array_address!, initial_assingment_size - i - 1, machine.OS.pop()!)
    }
    //restore the popped function
    machine.OS.push(array_builtin!);
    return [array_address, size]
}
export const array_builtins: Record<string, BuiltinFunction> = {
    Slice          : (machine, heap, _size, _initial_assingment_size) => {
                        const [array_addresss, size] = make_array(machine, heap, _size, _initial_assingment_size)
                        const slice_address = heap.allocate_Slice(array_addresss, 0, size)
                        return slice_address
                    },
    cut_Slice     : (machine, heap, _slice_address, _start_index, _end_index, _max_index) =>{
                        let new_max_index = heap.address_to_JS_value(machine.OS.pop()!)
                        let new_end_index = heap.address_to_JS_value(machine.OS.pop()!)
                        let new_start_index = heap.address_to_JS_value(machine.OS.pop()!)
                        const old_slice = machine.OS.pop()!
                        if (!heap.is_Slice(old_slice)) {
                            error("Attempt to cut an object which is not a Slice")
                        }
                        //The default is zero for the low bound and the length of the slice for the high bound. 
                        if (new_start_index === null) { 
                            new_start_index = 0
                        }
                        if (new_start_index < 0) {
                            error("Attempt to slice with a <0 starting index")
                        } 
                        const old_start_index = heap.get_Slice_start_index(old_slice)
                        const array_address = heap.get_Slice_array_address(old_slice)
                        const array_size = heap.get_Array_size(array_address)
                        //if old is 2 and new is 1, then new is now 3
                        new_start_index = old_start_index + new_start_index
                        if (new_end_index === null) {
                            //if end is not defined, take the maximum possible, which is the end of the old slice
                            new_end_index = heap.get_Slice_end_index(old_slice);
                        } else {
                            //if end index is 5 and old start is 3, new end is now 8
                            new_end_index = old_start_index + new_end_index
                        }
                        if (new_end_index > array_size) {
                            error("Attempt to cut a slice beyond the original slice's limit")
                        }
                        const new_slice = heap.allocate_Slice(array_address, new_start_index, new_end_index)
                        return new_slice
                    },
    get_Slice_element : (machine, heap, _address, _index) => {
                        const slice_index = heap.address_to_JS_value(machine.OS.pop()!)
                        const slice_address = machine.OS.pop()!
                        if (!heap.is_Slice(slice_address)) {
                            error("Attempt to get slice element of an object which is not a slice")
                        }
                        return heap.get_Slice_element(slice_address, slice_index)
                    },
    set_Slice_element : (machine, heap, _address, _index, _value) => {
                        const value = machine.OS.pop()!
                        const slice_index = heap.address_to_JS_value(machine.OS.pop()!)
                        const slice_address = machine.OS.pop()!
                        if (!heap.is_Slice(slice_address)) {
                            error("Attempt to set slice element of an object which is not a slice")
                        }
                        heap.set_Slice_element(slice_address, slice_index, value)
                    },
    len_slice    : (machine, heap, _address) => {
                        //need to allocate a number on the heap to return the result
                        const slice_address = machine.OS.pop()!
                        const result = heap.allocate_Number(heap.get_Slice_length(slice_address))
                        return result
    },
    cap_slice   :   (machine, heap, _address) => {
                        const slice_address = machine.OS.pop()!
                        const result = heap.allocate_Number(heap.get_Slice_capacity(slice_address))
                        return result
    },
    //The answer should always be false
    is_Array    : (machine, heap, _) => heap.is_Array(machine.OS.pop()!) ? heap.values.True : heap.values.False,
    is_Slice    : (machine, heap, _) => heap.is_Slice(machine.OS.pop()!) ? heap.values.True : heap.values.False
}