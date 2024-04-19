// *************************
// HEAP
// *************************/

import { builtins, added_builtins, constants } from "./builtins";
import { Machine } from "./machine";
import { word_to_string } from "./utilities";

const DEFAULT_HEAP_SIZE = 50000;

const WORD_SIZE = 8;

const NODE_SIZE = 20;

const MARK_OFFSET = 7; //last byte in the tag
const MARKED = 1;
const UNMARKED = 0;

const SIZE_OFFSET = 5;

// values

// All values are allocated on the heap as nodes. The first
// word of the node is a header, and the first byte of the
// header is a tag that identifies the type of node

// a little trick: tags are all negative so that we can use
// the first 4 bytes of the header as forwarding address
// in garbage collection: If the (signed) Int32 is
// non-negative, the node has been forwarded already.

const False_tag = 0;
const True_tag = 1;
const Number_tag = 2;
const Null_tag = 3;
const Unassigned_tag = 4;
const Undefined_tag = 5;
const Blockframe_tag = 6;
const Callframe_tag = 7;
const Closure_tag = 8;
const Frame_tag = 9; // 0000 1001
const Environment_tag = 10; // 0000 1010
const Pair_tag = 11;
const Builtin_tag = 12;
const Mutex_tag = 13;
const String_tag = 14;
const Whileframe_tag = 15;
const Array_tag = 16;
const Slice_tag = 17;
const Channel_tag = 18;
const Waitgroup_tag = 19;

type Builtins = Record<string, { id: number }>;
type Constants = Record<string, unknown>;

export class Heap {
  data: DataView;
  size: number;

  // free is the next free index in the free list
  free: number;

  // AMENDED: The last unused byte in the tag is now used as the markbit
  // the smallest heap address/first node address AFTER literals/constants/builtins
  bottom: number;
  // the last node address + 1
  top: number;

  // primitive values
  values: Record<
    "False" | "True" | "Null" | "Undefined" | "Unassigned",
    number
  >;

  // builtins and constants
  builtins_frame: number;
  added_builtins_frame: number;
  constants_frame: number;

  // list of attached machines
  machines: Set<Machine>;

  // strings stuff
  stringPool: Record<number, [number, string]> = {};

  // whether garbage collector is used
  gc_flag: boolean;

  // allocates a heap of given size (in bytes) and returns a DataView of that
  constructor(options?: {
    heap_size?: number;
    gc?: boolean;
    builtins?: Builtins;
    added_builtins?: Builtins;
    constants?: Constants;
  }) {
    const {
      heap_size = DEFAULT_HEAP_SIZE,
      builtins: custom_builtins = builtins,
      added_builtins: custom_added_builtins = added_builtins,
      constants: custom_constants = constants,
      gc = true,
    } = options || {};

    const data = new ArrayBuffer(heap_size * WORD_SIZE);
    this.data = new DataView(data);
    this.gc_flag = gc;

    this.size = heap_size;

    this.top = heap_size - NODE_SIZE + 1; //The address must be strictly lower than HEAPTOP
    // initialize free list:
    // every free node carries the address of the next free node as its first word
    let i = 0;
    for (i = 0; i <= heap_size - NODE_SIZE; i = i + NODE_SIZE) {
      this.set(i, i + NODE_SIZE);
    }
    // the empty free list is represented by -1
    this.set(i - NODE_SIZE, -1);
    this.free = 0;
    this.bottom = this.free;

    this.values = {
      False: this.allocate(False_tag, 1),
      True: this.allocate(True_tag, 1),
      Null: this.allocate(Null_tag, 1),
      Unassigned: this.allocate(Unassigned_tag, 1),
      Undefined: this.allocate(Undefined_tag, 1),
    };

    this.machines = new Set();

    this.builtins_frame = this.allocate_builtin_frame(custom_builtins);
    this.added_builtins_frame = this.allocate_builtin_frame(
      custom_added_builtins,
    );
    this.constants_frame = this.allocate_constant_frame(custom_constants);

    // Initialize HEAPBOTTOM. This ensures that literals, builtins and constants are never swept.
    this.bottom = this.free;
  }

  allocate_builtin_frame(builtins: Builtins) {
    const builtin_values = Object.values(builtins);
    const frame_address = this.allocate_Frame(builtin_values.length);
    for (let i = 0; i < builtin_values.length; i++) {
      const builtin = builtin_values[i];
      this.set_child(frame_address, i, this.allocate_Builtin(builtin.id));
    }
    return frame_address;
  }

  allocate_constant_frame(constants: Constants) {
    const constant_values = Object.values(constants);
    const frame_address = this.allocate_Frame(constant_values.length);
    for (let i = 0; i < constant_values.length; i++) {
      const constant_value = constant_values[i];
      if (typeof constant_value === "undefined") {
        this.set_child(frame_address, i, this.values.Undefined);
      } else {
        this.set_child(
          frame_address,
          i,
          this.allocate_Number(constant_value as number),
        );
      }
    }
    return frame_address;
  }

  add_machine(machine: Machine) {
    this.machines.add(machine);
  }

  // allocate allocates a given number of words
  // on the heap and marks the first word with a 1-byte tag.
  // the last two bytes of the first word indicate the number
  // of children (addresses) that follow the tag word:
  // [1 byte tag, 4 bytes payload (depending on node type),
  //  2 bytes #children, 1 byte unused]
  // Note: payload depends on the type of node
  allocate(tag: number, size: number) {
    if (size > NODE_SIZE) {
      throw new Error("limitation: nodes cannot be larger than 10 words");
    }
    // a value of -1 in free indicates the end of the free list
    if (this.free === -1) {
      if (this.gc_flag) {
        this.mark_sweep();
      } else {
        throw new Error("Out of memory and garbage collector turned off");
      }
    }
    const address = this.free;
    this.free = this.get(this.free);
    this.data.setInt8(address * WORD_SIZE, tag);
    this.data.setUint16(address * WORD_SIZE + SIZE_OFFSET, size);
    return address;
  }

  is_marked(address: number) {
    return this.get_byte_at_offset(address, MARK_OFFSET) === MARKED;
  }

  //AMENDED
  //v should be the address of the node
  mark_byte(address: number) {
    this.set_byte_at_offset(address, MARK_OFFSET, MARKED);
  }

  unmark_byte(address: number) {
    this.set_byte_at_offset(address, MARK_OFFSET, UNMARKED);
  }

  mark(address: number) {
    if (this.is_marked(address)) {
      //if marked, do nothing
      return;
    }
    // console.log('Marking', v)
    //mark the tag at the address of the node
    this.mark_byte(address);
    //mark the children of that node recursively
    const n_children = this.get_number_of_children(address);
    // console.log('node-n_children', v, n_children);
    for (let i = 0; i < n_children; i++) {
      const child = this.get_child(address, i);
      this.mark(child);
    }
    // console.log('Finished marking', v)
  }

  //function for deleting unreachable nodes
  free_node(address: number) {
    // console.log('freeing address-tag', v, heap.get_tag(v));
    this.set(address, this.free); //the first word of the node now points to free
    this.free = address; //v is marked as a free node, and will be the first to be allocated
  }

  sweep() {
    // console.log('sweep start');
    //deal with edge case where the amount of heap is exactly enough for allocate_literal_values/built_ins/constants
    //Then bottom would be -1 and Ihis machine will crash
    if (this.bottom === -1) {
      return;
    }
    //Main loop
    for (let v = this.bottom; v < this.top; v = v + NODE_SIZE) {
      if (this.is_marked(v)) {
        // console.log('mark tag', this.get_tag(v));
        // console.log('wts - before unmark', word_to_string(this.get(v)));
        this.unmark_byte(v);
        // console.log('wts - after unmark', word_to_string(this.get(v)));
      } else {
        this.free_node(v);
      }
    }
    // console.log('sweep end');
  }

  mark_sweep() {
    // console.log('Running mark_sweep');
    //Deal with edge case where the memory runs out before the first environment gets allocated on the HEAP
    for (const machine of this.machines) {
      if (machine.E === undefined) {
        throw new Error("heap memory exhausted");
      }
    }
    //This should be an array of addresses
    const ROOTS = Array.from(this.machines).flatMap((machine) => [
      ...machine.OS,
      machine.E,
      ...machine.RTS,
      ...machine.get_temporary_roots(),
    ]);
    // console.log('OS-start of mark sweep', OS);
    // console.log('RTS-start of mark sweep', RTS);
    // console.log('E-start of mark sweep', E);
    // console.log('Displaying current Environment', E)
    // heap.Environment_console.log(heap.get_Callframe_environment(E))
    // RTS.forEach((address) => {
    //     if (heap.get_tag(address) === Callframe_tag) {
    //         console.log('Displaying environment of Callframe - ', address)
    //         console.log('Environment Address - ', heap.get_Callframe_environment(address))
    //         heap.Environment_console.log(heap.get_Callframe_environment(address))
    //     } else if (heap.get_tag(address) === Blockframe_tag) {
    //         console.log('Displaying environment of Blockframe - ', address)
    //         console.log('Environment Address - ', heap.get_Blockframe_environment(address))
    //         heap.Environment_console.log(heap.get_Blockframe_environment(address))
    //     }
    // })
    const mark_alias = (address) => this.mark(address);
    ROOTS.forEach(mark_alias);
    this.sweep();
    if (this.free === -1) {
      throw new Error("heap memory exhausted");
    }
    // console.log('mark_sweep done!')
  }

  // already_copied(node) => {
  // return this.get_forwarding_address(node) >= to_space &&
  // this.get_forwarding_address(node) <= free
  // }

  set_forwarding_address(node: number, address: number) {
    this.data.setInt32(node * WORD_SIZE, address);
  }
  get_forwarding_address(node: number) {
    return this.data.getInt32(node * WORD_SIZE);
  }

  // get and set a word in heap at given address
  get(address: number) {
    return this.data.getFloat64(address * WORD_SIZE);
  }
  set(address: number, x: number) {
    this.data.setFloat64(address * WORD_SIZE, x);
  }

  // child index starts at 0
  get_child(address: number, child_index: number) {
    return this.get(address + 1 + child_index);
  }
  set_child(address: number, child_index: number, value: number) {
    this.set(address + 1 + child_index, value);
  }

  get_tag(address: number) {
    return this.data.getInt8(address * WORD_SIZE);
  }

  get_size(address: number) {
    return this.data.getUint16(address * WORD_SIZE + SIZE_OFFSET);
  }

  // the number of children is one less than the size except for number nodes:
  // they have size 2 but no children
  get_number_of_children(address: number) {
    return this.get_tag(address) === Number_tag
      ? 0
      : this.get_size(address) - 1;
  }

  // access byte in heap, using address and offset
  set_byte_at_offset(address: number, offset: number, value: number) {
    this.data.setUint8(address * WORD_SIZE + offset, value);
  }
  get_byte_at_offset(address: number, offset: number) {
    return this.data.getUint8(address * WORD_SIZE + offset);
  }
  set_2_bytes_at_offset(address: number, offset: number, value: number) {
    this.data.setUint16(address * WORD_SIZE + offset, value);
  }
  get_2_bytes_at_offset(address: number, offset: number) {
    return this.data.getUint16(address * WORD_SIZE + offset);
  }

  // set_4_bytes used by string pool
  set_4_bytes_at_offset(address: number, offset: number, value: number) {
    return this.data.setUint32(address * WORD_SIZE + offset, value);
  }

  get_4_bytes_at_offset(address: number, offset: number) {
    return this.data.getUint32(address * WORD_SIZE + offset);
  }

  // all values (including literals) are allocated on the heap.

  // We allocate canonical values for
  // true, false, undefined, null, and unassigned
  // and make sure no such values are created at runtime

  // boolean values carry their value (0 for false, 1 for true)
  // in the byte following the tag
  is_False(address: number) {
    return this.get_tag(address) === False_tag;
  }
  is_True(address: number) {
    return this.get_tag(address) === True_tag;
  }
  is_Boolean(address: number) {
    return this.is_True(address) || this.is_False(address);
  }
  is_Null(address: number) {
    return this.get_tag(address) === Null_tag;
  }
  is_Unassigned(address: number) {
    return this.get_tag(address) === Unassigned_tag;
  }
  is_Undefined(address: number) {
    return this.get_tag(address) === Undefined_tag;
  }

  // builtins: builtin id is encoded in second byte
  // [1 byte tag, 1 byte id, 3 bytes unused, 2 bytes #children, 1 byte unused]
  // Note: #children is 0
  is_Builtin(address: number) {
    return this.get_tag(address) === Builtin_tag;
  }
  allocate_Builtin(id: number) {
    const address = this.allocate(Builtin_tag, 1);
    this.set_byte_at_offset(address, 1, id);
    return address;
  }
  get_Builtin_id(address: number) {
    return this.get_byte_at_offset(address, 1);
  }

  //Strings, taken from homework solution
  is_String(address: number) {
    return this.get_tag(address) === String_tag;
  }

  // strings:
  // [1 byte tag, 4 byte hash to stringPool,
  // 2 bytes #children, 1 byte unused]
  // Note: #children is 0

  // Hash any string to a 32-bit unsigned integer
  hashString(str: string) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) + hash + char;
      hash = hash & hash;
    }
    return hash >>> 0;
  }

  allocate_String(str: string) {
    const hash = this.hashString(str);
    const address_or_undefined = this.stringPool[hash];

    if (address_or_undefined !== undefined) {
      return address_or_undefined[0];
    }
    const address = this.allocate(String_tag, 1);
    this.set_4_bytes_at_offset(address, 1, hash);

    // Store the string in the string pool
    this.stringPool[hash] = [address, str];
    return address;
  }

  get_string_hash(address: number) {
    return this.get_4_bytes_at_offset(address, 1);
  }

  get_string(address: number) {
    return this.stringPool[this.get_string_hash(address)][1];
  }

  // closure
  // [1 byte tag, 1 byte arity, 2 bytes pc, 1 byte unused, 2 bytes #children, 1 byte unused]
  // followed by the address of env
  // note: currently bytes at offset 4 and 7 are not used;
  //   they could be used to increase pc and #children range
  allocate_Closure(arity: number, pc: number, env: number) {
    const address = this.allocate(Closure_tag, 2);
    this.set_byte_at_offset(address, 1, arity);
    this.set_2_bytes_at_offset(address, 2, pc);
    this.set(address + 1, env);
    return address;
  }
  get_Closure_arity(address: number) {
    return this.get_byte_at_offset(address, 1);
  }
  get_Closure_pc(address: number) {
    return this.get_2_bytes_at_offset(address, 2);
  }
  get_Closure_environment(address: number) {
    return this.get_child(address, 0);
  }
  is_Closure(address: number) {
    return this.get_tag(address) === Closure_tag;
  }

  // block frame
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
  allocate_Blockframe(env: number) {
    const address = this.allocate(Blockframe_tag, 2);
    this.set(address + 1, env);
    return address;
  }
  get_Blockframe_environment(address: number) {
    return this.get_child(address, 0);
  }
  is_Blockframe(address: number) {
    return this.get_tag(address) === Blockframe_tag;
  }

  // call frame
  // [1 byte tag, 1 byte unused, 2 bytes pc, 1 byte unused, 2 bytes #children, 1 byte unused]
  // followed by the address of env
  allocate_Callframe(env: number, pc: number) {
    const address = this.allocate(Callframe_tag, 2);
    this.set_2_bytes_at_offset(address, 2, pc);
    this.set(address + 1, env);
    return address;
  }
  get_Callframe_environment(address: number) {
    return this.get_child(address, 0);
  }
  get_Callframe_pc(address: number) {
    return this.get_2_bytes_at_offset(address, 2);
  }
  is_Callframe(address: number) {
    return this.get_tag(address) === Callframe_tag;
  }

  // while frame
  // [1 byte tag, 2 bytes start address, 2 bytes end address, 2 bytes #children, 1 byte unused]
  // followed by the address of env
  //start and end are pc
  allocate_Whileframe(env: number, start: number, end: number) {
    const address = this.allocate(Whileframe_tag, 2);
    this.set_2_bytes_at_offset(address, 1, start);
    this.set_2_bytes_at_offset(address, 3, end);
    this.set(address + 1, env);
    return address;
  }
  get_Whileframe_environment(address: number) {
    return this.get_child(address, 0);
  }
  get_Whileframe_start(address: number) {
    return this.get_2_bytes_at_offset(address, 1);
  }
  get_Whileframe_end(address: number) {
    return this.get_2_bytes_at_offset(address, 3);
  }
  is_Whileframe(address: number) {
    return this.get_tag(address) === Whileframe_tag;
  }

  // environment frame
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
  // followed by the addresses of its values
  allocate_Frame(number_of_values: number) {
    return this.allocate(Frame_tag, number_of_values + 1);
  }
  display_Frame(address: number) {
    console.log("", "Frame:");
    const size = this.get_number_of_children(address);
    console.log(size, "frame size:");
    for (let i = 0; i < size; i++) {
      console.log(i, "value address:");
      const value = this.get_child(address, i);
      console.log(value, "value:");
      console.log(word_to_string(value), "value word:");
    }
  }

  // environment
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
  // followed by the addresses of its frames
  allocate_Environment(number_of_frames: number) {
    return this.allocate(Environment_tag, number_of_frames + 1);
  }

  // access environment given by address using a "position", i.e. a pair of
  // frame index and value index
  get_Environment_value(
    env_address: number,
    position: readonly [number, number],
  ) {
    const [frame_index, value_index] = position;
    const frame_address = this.get_child(env_address, frame_index);
    return this.get_child(frame_address, value_index);
  }
  set_Environment_value(
    env_address: number,
    position: readonly [number, number],
    value: number,
  ) {
    const [frame_index, value_index] = position;
    const frame_address = this.get_child(env_address, frame_index);
    this.set_child(frame_address, value_index, value);
  }

  // extend a given environment by a new frame:
  // create a new environment that is bigger by 1
  // frame slot than the given environment.
  // copy the frame Addresses of the given
  // environment to the new environment.
  // enter the address of the new frame to end
  // of the new environment
  extend_Environment(frame_address: number, env_address: number) {
    const old_size = this.get_size(env_address);
    const new_env_address = this.allocate_Environment(old_size);
    let i: number;
    for (i = 0; i < old_size - 1; i++) {
      this.set_child(new_env_address, i, this.get_child(env_address, i));
    }
    this.set_child(new_env_address, i, frame_address);
    return new_env_address;
  }

  // for debuggging: display environment
  display_Environment(env_address: number) {
    const size = this.get_number_of_children(env_address);
    console.log("", "Environment:");
    console.log(size, "environment size:");
    for (let i = 0; i < size; i++) {
      console.log(i, "frame index:");
      const frame = this.get_child(env_address, i);
      console.log(frame);
    }
  }

  // pair
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
  // followed by head and tail addresses, one word each
  allocate_Pair(hd: number, tl: number) {
    const pair_address = this.allocate(Pair_tag, 3);
    this.set_child(pair_address, 0, hd);
    this.set_child(pair_address, 1, tl);
    return pair_address;
  }
  is_Pair(address: number) {
    return this.get_tag(address) === Pair_tag;
  }

  // Array
  // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
  // followed by head and tail addresses, one word each
  allocate_Array(size: number) {
    //limitation with constant sized nodes
    if (size > NODE_SIZE - 1) {
      throw new Error(
        `Attempt to allocate array of size ${size} failed due to fixed node size`,
      );
    }
    //size of node is the tag + number of children (array elements)
    const array_address = this.allocate(Array_tag, size + 1);
    //initialize array values to null
    for (let i = 0; i < size; i++) {
      this.set_child(array_address, i, this.values.Null);
    }
    return array_address;
  }
  get_Array_element(address: number, index: number) {
    //returns the address of the index. Index is 0-indexed, same as get_child.
    if (this.get_tag(address) !== Array_tag) {
      throw new Error(
        "Attempt to get array element of an object that is not an array",
      );
    }
    const n_elements = this.get_number_of_children(address);
    if (index < 0 || index + 1 > n_elements) {
      throw new Error(
        `Index ${index} provided for array access is out of range for array of size ${n_elements}`,
      );
    }
    return this.get_child(address, index);
  }
  set_Array_element(address: number, index: number, value: number) {
    //sets an array at a specified index to the value and returns nothing.
    if (this.get_tag(address) !== Array_tag) {
      throw new Error(
        `Attempt to set array element of an object of tag ${this.get_tag(address)} i.e. not an array`,
      );
    }
    const n_elements = this.get_number_of_children(address);
    if (index < 0 || index + 1 > n_elements) {
      throw new Error(
        `Index ${index} provided for setting array is out of range for array of size ${n_elements}`,
      );
    }
    return this.set_child(address, index, value);
  }
  get_Array_size(address: number) {
    if (this.get_tag(address) !== Array_tag) {
      throw new Error("Attempt to get size of an object that is not an array");
    }
    return this.get_number_of_children(address);
  }
  is_Array(address: number) {
    return this.get_tag(address) === Array_tag;
  }

  // Slice
  // [1 byte tag, 1 byte start index, 1 byte end index, 2 bytes capacity, 2 bytes #children, 1 byte unused]
  // 1 child - the array
  //Note that the end index is NOT ACCESSABLE, to keep the syntax the same as slice declaration
  //i.e. s[2:4] creates a slice that allows for access to index 2 and 3, the start index is 2 and the end index is 4
  SLICE_START_INDEX_OFFSET = 1;
  SLICE_END_INDEX_OFFSET = 2;
  SLICE_CAPACITY_OFFSET = 3;
  allocate_Slice(
    array_address: number,
    start_index: number,
    end_index: number,
  ) {
    if (!this.is_Array(array_address)) {
      throw new Error(
        "Attempt to allocate Slice using an address which is not an Array",
      );
    }
    const capacity = this.get_Array_size(array_address) - start_index;
    const slice_address = this.allocate(Slice_tag, 2);
    this.set_byte_at_offset(
      slice_address,
      this.SLICE_START_INDEX_OFFSET,
      start_index,
    );
    this.set_byte_at_offset(
      slice_address,
      this.SLICE_END_INDEX_OFFSET,
      end_index,
    );
    this.set_2_bytes_at_offset(
      slice_address,
      this.SLICE_CAPACITY_OFFSET,
      capacity!,
    );
    this.set_child(slice_address, 0, array_address);
    return slice_address;
  }
  get_Slice_array_address(slice_address: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to get array address of an object that is not a slice",
      );
    }
    return this.get_child(slice_address, 0);
  }
  get_Slice_start_index(slice_address: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to get start index of an object that is not a slice",
      );
    }
    return this.get_byte_at_offset(
      slice_address,
      this.SLICE_START_INDEX_OFFSET,
    );
  }
  get_Slice_end_index(slice_address: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to get end index of an object that is not a slice",
      );
    }
    return this.get_byte_at_offset(slice_address, this.SLICE_END_INDEX_OFFSET);
  }
  get_Slice_length(slice_address: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error("Attempt to get length of an object that is not a slice");
    }
    return (
      this.get_Slice_end_index(slice_address) -
      this.get_Slice_start_index(slice_address)
    );
  }
  get_Slice_capacity(slice_address: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to get capacity of an object that is not a slice",
      );
    }
    return this.get_2_bytes_at_offset(
      slice_address,
      this.SLICE_CAPACITY_OFFSET,
    );
  }
  get_Array_index_from_Slice_index(slice_address: number, slice_index: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to get the corresponding array index of an object that is not a slice",
      );
    }
    const slice_start_index = this.get_Slice_start_index(slice_address);
    const slice_end_index = this.get_Slice_end_index(slice_address);
    const array_index = slice_index + slice_start_index;
    if (array_index >= slice_end_index) {
      throw new Error(
        `Out of range access for slice: array index: ${array_index}; max index(exclusive): ${slice_end_index}`,
      );
    } else if (array_index < slice_start_index) {
      throw new Error(
        `Out of range access for slice: array index: ${array_index}; min index(inclusive): ${slice_start_index}`,
      );
    }
    return array_index;
  }
  get_Slice_element(slice_address: number, slice_index: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to get the slice element of an object that is not a slice",
      );
    }
    const array_address = this.get_Slice_array_address(slice_address);
    const array_index = this.get_Array_index_from_Slice_index(
      slice_address,
      slice_index,
    );
    return this.get_Array_element(array_address, array_index);
  }
  set_Slice_element(slice_address: number, slice_index: number, value: number) {
    if (!this.is_Slice(slice_address)) {
      throw new Error(
        "Attempt to set the slice element of an object that is not a slice",
      );
    }
    const array_address = this.get_Slice_array_address(slice_address);
    const array_index = this.get_Array_index_from_Slice_index(
      slice_address,
      slice_index,
    );
    return this.set_Array_element(array_address, array_index, value);
  }
  is_Slice(address: number) {
    return this.get_tag(address) === Slice_tag;
  }

  // number
  // [1 byte tag, 4 bytes unused,
  //  2 bytes #children, 1 byte unused]
  // followed by the number, one word
  // note: #children is 0
  allocate_Number(n: number) {
    const number_address = this.allocate(Number_tag, 2);
    this.set(number_address + 1, n);
    return number_address;
  }
  is_Number(address: number) {
    return this.get_tag(address) === Number_tag;
  }
  //Mutex
  // [1 byte tag, 4 bytes unused,
  //  2 bytes #children, 1 byte unused]
  // followed by the number, one word
  allocate_Mutex(n: number) {
    const mutex_address = this.allocate(Mutex_tag, 2);
    this.set_child(mutex_address, 0, n);
    return mutex_address;
  }

  set_Mutex_value(address: number, value: number) {
    if (!this.is_Mutex(address)) {
      throw new TypeError(
        "Attempt to set Mutex value of an address which is not a Mutex",
      );
    }
    return this.set_child(address, 0, value);
  }

  get_Mutex_value(address: number) {
    if (!this.is_Mutex(address)) {
      throw new TypeError(
        "Attempt to get Mutex value of an address which is not a Mutex",
      );
    }
    return this.get_child(address, 0);
  }

  is_Mutex(address: number) {
    return this.get_tag(address) === Mutex_tag;
  }
  //Waitgroup
  // [1 byte tag, 4 bytes unused,
  //  2 bytes #children, 1 byte unused]
  // followed by the number, one word
  allocate_Waitgroup(n: number) {
    const waitgroup_address = this.allocate(Waitgroup_tag, 2);
    this.set_child(waitgroup_address, 0, n);
    return waitgroup_address;
  }

  set_Waitgroup_value(address: number, value: number) {
    if (!this.is_Waitgroup(address)) {
      throw new TypeError(
        "Attempt to set Mutex value of an address which is not a Mutex",
      );
    }
    return this.set_child(address, 0, value);
  }

  get_Waitgroup_value(address: number) {
    if (!this.is_Waitgroup(address)) {
      throw new TypeError(
        "Attempt to get Mutex value of an address which is not a Mutex",
      );
    }
    return this.get_child(address, 0);
  }

  is_Waitgroup(address: number) {
    return this.get_tag(address) === Waitgroup_tag;
  }

  // channel
  // [1 byte tag, 2 bytes number of buffered items,
  // 2 bytes unused, 2 bytes #children, 1 byte unused]
  // followed by children
  allocate_Channel(size: number) {
    // limitation with constant sized nodes
    if (size > NODE_SIZE - 1) {
      throw new Error(
        `Attempt to allocate channel of size ${size} failed due to fixed node size`,
      );
    }
    // size of node is the tag + number of children (array elements)
    const channel_address = this.allocate(Channel_tag, size + 1);
    this.set_2_bytes_at_offset(channel_address, 1, 0);
    if (size > 0) {
      for (let i = 0; i < size; i++) {
        this.set_child(channel_address, i, this.values.Undefined);
      }
    }
    return channel_address;
  }
  get_Channel_item_count(address: number) {
    if (!this.is_Channel(address)) {
      throw new Error("Cannot get capacity of an object that is not a channel");
    }
    return this.get_2_bytes_at_offset(address, 1);
  }
  push_Channel_item(channel_address: number, value: number) {
    if (!this.is_Channel(channel_address)) {
      throw new Error("Cannot push item to object that is not a channel");
    }
    const item_count = this.get_Channel_item_count(channel_address);
    const size = this.get_number_of_children(channel_address);
    if (size - item_count <= 0) {
      return { state: "failed" };
    }
    this.set_child(channel_address, item_count, value);
    this.set_2_bytes_at_offset(channel_address, 1, item_count + 1);
    return { state: "success" };
  }
  pop_Channel_item(channel_address: number) {
    if (!this.is_Channel(channel_address)) {
      throw new Error("Cannot push item to object that is not a channel");
    }
    const item_count = this.get_Channel_item_count(channel_address);
    if (item_count <= 0) {
      return { state: "failed" } as const;
    }
    const value = this.get_child(channel_address, 0);
    for (let i = 0; i < item_count - 1; i++) {
      this.set_child(
        channel_address,
        i,
        this.get_child(channel_address, i + 1),
      );
    }
    this.set_2_bytes_at_offset(channel_address, 1, item_count - 1);
    return { state: "success", value } as const;
  }
  is_Channel(address: number) {
    return this.get_tag(address) === Channel_tag;
  }

  // conversions between addresses and JS_value
  slice_to_JS_value(slice_address: number) {
    const output: any[] = [];
    const initial_index = this.get_Slice_start_index(slice_address);
    const end_index = this.get_Slice_end_index(slice_address);
    const array_address = this.get_Slice_array_address(slice_address);
    for (let i = initial_index; i < end_index!; i++) {
      const element = this.get_Array_element(array_address, i);
      output.push(this.address_to_JS_value(element!));
    }
    return output;
  }
  address_to_JS_value(x: number) {
    if (this.is_Boolean(x)) return this.is_True(x) ? true : false;
    if (this.is_Number(x)) return this.get(x + 1);
    if (this.is_String(x)) return this.get_string(x);
    if (this.is_Undefined(x)) return undefined;
    if (this.is_Null(x)) return null;
    if (this.is_Unassigned(x)) return "<unassigned>";
    if (this.is_Pair(x))
      return [
        this.address_to_JS_value(this.get_child(x, 0)),
        this.address_to_JS_value(this.get_child(x, 1)),
      ];
    if (this.is_Mutex(x)) return `<mutex: value ${this.get_child(x, 0)}>`;
    if (this.is_Waitgroup(x))
      return `<waitgroup: value ${this.get_child(x, 0)}>`;
    if (this.is_Slice(x)) return this.slice_to_JS_value(x);
    if (this.is_Closure(x))
      return `<closure: arity ${this.get_Closure_arity(x)}; pc ${this.get_Closure_pc(x)}>`;
    if (this.is_Channel(x))
      return `<channel: buffer size ${this.get_number_of_children(x)}>`;
    if (this.is_Builtin(x)) return "<builtin>";
    if (this.is_Callframe(x)) return "<callframe>";
    if (this.is_Blockframe(x)) return "<blockframe>";
    if (this.is_Whileframe(x)) return "<whileframe>";

    return `<unknown word tag: ${word_to_string(x)}`;
  }
}
