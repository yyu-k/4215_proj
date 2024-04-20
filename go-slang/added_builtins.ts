import { Heap } from "./heap";
import { Machine } from "./machine";

export const MUTEX_CONSTANTS = {
  MUTEX_LOCKED: 1,
  MUTEX_UNLOCKED: 0,
};

type BuiltinFunction = (
  machine: Machine,
  heap: Heap,
  ...args: unknown[]
) => unknown;

export const mutex_builtins: Record<string, BuiltinFunction> = {
  Mutex: (machine, heap) => heap.allocate_Mutex(MUTEX_CONSTANTS.MUTEX_UNLOCKED),
  is_mutex: (machine, heap, _) =>
    heap.is_Mutex(machine.OS.pop()!) ? heap.values.True : heap.values.False,
};

export const waitGroup_builtins: Record<string, BuiltinFunction> = {
  WaitGroup: (machine, heap) =>
    heap.allocate_Waitgroup(MUTEX_CONSTANTS.MUTEX_UNLOCKED),
  is_waitGroup: (machine, heap, _) =>
    heap.is_Waitgroup(machine.OS.pop()!) ? heap.values.True : heap.values.False,
};

const copy_append = (
  machine: Machine,
  heap: Heap,
  current_slice_address: number,
  item: number,
) => {
  const current_array_address = heap.get_Slice_array_address(
    current_slice_address,
  );
  const current_capacity = heap.get_Slice_capacity(current_slice_address);
  const current_start_index = heap.get_Slice_start_index(current_slice_address);
  const needed_capacity = current_capacity + 1;
  const new_array_address = heap.allocate_Array(needed_capacity)!;
  let new_index = 0;
  //copy; current_start_index + current_capacity gives max index + 1
  for (
    let i = current_start_index;
    i < current_start_index + current_capacity;
    i++
  ) {
    const value = heap.get_Array_element(current_array_address, i)!;
    heap.set_Array_element(new_array_address, new_index, value);
    new_index++;
  }
  //set the appended item
  heap.set_Array_element(new_array_address, new_index, item);
  //Create the corresponding slice
  const new_slice_address = heap.allocate_Slice(
    new_array_address,
    0,
    needed_capacity,
  );
  return new_slice_address;
};
export const array_builtins: Record<string, BuiltinFunction> = {
  len_slice: (machine, heap, _address) => {
    //need to allocate a number on the heap to return the result
    const slice_address = machine.OS.pop()!;
    const result = heap.allocate_Number(heap.get_Slice_length(slice_address));
    return result;
  },
  cap_slice: (machine, heap, _address) => {
    const slice_address = machine.OS.pop()!;
    const result = heap.allocate_Number(heap.get_Slice_capacity(slice_address));
    return result;
  },
  append: (machine, heap, _address, _item) => {
    const item = machine.OS.pop()!;
    const slice_address = machine.OS.pop()!;
    const slice_capacity = heap.get_Slice_capacity(slice_address);
    const current_start_index = heap.get_Slice_start_index(slice_address);
    const current_slice_end_index = heap.get_Slice_end_index(slice_address);
    const current_array_address = heap.get_Slice_array_address(slice_address);
    //current_start_index + slice_capacity should give the size of the underlying array
    if (current_slice_end_index >= current_start_index + slice_capacity) {
      return copy_append(machine, heap, slice_address, item);
    }
    const new_slice_end_index = current_slice_end_index + 1;
    const new_slice_address = heap.allocate_Slice(
      current_array_address,
      current_start_index,
      new_slice_end_index,
    );
    heap.set_Array_element(
      current_array_address,
      new_slice_end_index - 1,
      item,
    );
    return new_slice_address;
  },
  //The answer should always be false
  is_Array: (machine, heap, _) =>
    heap.is_Array(machine.OS.pop()!) ? heap.values.True : heap.values.False,
  is_Slice: (machine, heap, _) =>
    heap.is_Slice(machine.OS.pop()!) ? heap.values.True : heap.values.False,
};
