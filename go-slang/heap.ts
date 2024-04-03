// *************************
// HEAP
// *************************/

import { Machine } from "./machine";
import { error, word_to_string } from "./utilities";

export class Mutex {
    identity : string = "mutex"
    count : number
    constructor(n : number) {
        this.count = n;
    }
}

const WORD_SIZE = 8

const NODE_SIZE = 20

const MARK_OFFSET = 7; //last byte in the tag
const MARKED = 1;
const UNMARKED = 0;

const SIZE_OFFSET = 5

// values

// All values are allocated on the heap as nodes. The first
// word of the node is a header, and the first byte of the
// header is a tag that identifies the type of node

// a little trick: tags are all negative so that we can use
// the first 4 bytes of the header as forwarding address
// in garbage collection: If the (signed) Int32 is
// non-negative, the node has been forwarded already.

const False_tag          = 0
const True_tag           = 1
const Number_tag         = 2
const Null_tag           = 3
const Unassigned_tag     = 4
const Undefined_tag      = 5
const Blockframe_tag     = 6
const Callframe_tag      = 7
const Closure_tag        = 8
const Frame_tag          = 9  // 0000 1001
const Environment_tag    = 10 // 0000 1010
const Pair_tag           = 11
const Builtin_tag        = 12
const Mutex_tag          = 13

type Builtins = Record<string, { id: number }>
type Constants = Record<string, unknown>

export class Heap {
    data: DataView
    size: number

    // free is the next free index in the free list
    free: number

    // AMENDED: The last unused byte in the tag is now used as the markbit
    // the smallest heap address/first node address AFTER literals/constants/builtins
    bottom: number
    // the last node address + 1
    top: number

    // primitive values
    values: Record<string, number>

    // builtins and constants
    builtins_frame: number
    constants_frame: number

    // list of attached machines
    machines: Set<Machine>

    // allocates a heap of given size (in bytes) and returns a DataView of that
    constructor(words: number, builtins: Builtins, constants: Constants) {
        const data = new ArrayBuffer(words * WORD_SIZE)
        this.data = new DataView(data)
        this.size = words

        this.top = words - NODE_SIZE + 1 //The address must be strictly lower than HEAPTOP
        // initialize free list:
        // every free node carries the address of the next free node as its first word
        let i = 0
        for (i = 0; i <= words - NODE_SIZE; i = i + NODE_SIZE) {
            this.set(i, i + NODE_SIZE)
        }
        // the empty free list is represented by -1
        this.set(i - NODE_SIZE, -1)
        this.free = 0
        this.bottom = this.free;

        this.values = {}
        this.values.False = this.allocate(False_tag, 1)
        this.values.True = this.allocate(True_tag, 1)
        this.values.Null = this.allocate(Null_tag, 1)
        this.values.Unassigned = this.allocate(Unassigned_tag, 1)
        this.values.Undefined = this.allocate(Undefined_tag, 1)

        this.machines = new Set()

        this.builtins_frame = this.allocate_builtin_frame(builtins)
        this.constants_frame = this.allocate_constant_frame(constants)

        // Initialize HEAPBOTTOM. This ensures that literals, builtins and constants are never swept.
        this.bottom = this.free;
    }

    allocate_builtin_frame(builtins: Builtins) {
        const builtin_values = Object.values(builtins)
        const frame_address = this.allocate_Frame(builtin_values.length)
        for (let i = 0; i < builtin_values.length; i++) {
            const builtin = builtin_values[i];
            this.set_child(
                frame_address,
                i,
                this.allocate_Builtin(builtin.id))
        }
        return frame_address
    }

    allocate_constant_frame(constants: Constants) {
        const constant_values = Object.values(constants)
        const frame_address = this.allocate_Frame(constant_values.length)
        for (let i = 0; i < constant_values.length; i++) {
            const constant_value = constant_values[i];
            if (typeof constant_value === "undefined") {
                this.set_child(frame_address, i, this.values.Undefined)
            } else {
                this.set_child(
                    frame_address,
                    i,
                    this.allocate_Number(constant_value as number))
            }
        }
        return frame_address
    }

    add_machine(machine: Machine) {
        this.machines.add(machine)
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
            error("limitation: nodes cannot be larger than 10 words")
        }
	// a value of -1 in free indicates the end of the free list
        if (this.free === -1) {
            this.mark_sweep();
        }
        const address = this.free
        this.free = this.get(this.free)
        this.data.setInt8(address * WORD_SIZE, tag)
        this.data.setUint16(address * WORD_SIZE + SIZE_OFFSET, size)
        return address
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
        this.set(address, this.free) //the first word of the node now points to free
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
                error("heap memory exhausted")
            }
        }
        //This should be an array of addresses
        const ROOTS = Array.from(this.machines)
            .flatMap(machine => [...machine.OS, machine.E, ...machine.RTS])
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
        ROOTS.forEach(this.mark)
        this.sweep();
        if (this.free === -1) {
            error("heap memory exhausted")
        }
        // console.log('mark_sweep done!')
    }

    // already_copied(node) => {
    // return this.get_forwarding_address(node) >= to_space &&
    // this.get_forwarding_address(node) <= free
    // }

    set_forwarding_address(node: number, address: number) {
        this.data.setInt32(node * WORD_SIZE, address)
    }
    get_forwarding_address(node: number) {
        return this.data.getInt32(node * WORD_SIZE)
    }

    // get and set a word in heap at given address
    get(address: number) {
        return this.data.getFloat64(address * WORD_SIZE)
    }
    set(address: number, x: number) {
        this.data.setFloat64(address * WORD_SIZE, x)
    }

    // child index starts at 0
    get_child(address: number, child_index: number) {
        return this.get(address + 1 + child_index)
    }
    set_child(address: number, child_index: number, value: number) {
        this.set(address + 1 + child_index, value)
    }

    get_tag(address: number) {
        return this.data.getInt8(address * WORD_SIZE)
    }

    get_size(address: number) {
        return this.data.getUint16(address * WORD_SIZE + SIZE_OFFSET)
    }

    // the number of children is one less than the size except for number nodes:
    // they have size 2 but no children
    get_number_of_children(address: number) {
        return this.get_tag(address) === Number_tag
        ? 0
        : this.get_size(address) - 1
    }

    // access byte in heap, using address and offset
    set_byte_at_offset(address: number, offset: number, value: number) {
        this.data.setUint8(address * WORD_SIZE + offset, value)
    }
    get_byte_at_offset(address: number, offset: number) {
        return this.data.getUint8(address * WORD_SIZE + offset)
    }
    set_2_bytes_at_offset(address: number, offset: number, value: number) {
        this.data.setUint16(address * WORD_SIZE + offset, value)
    }
    get_2_bytes_at_offset(address: number, offset: number) {
        return this.data.getUint16(address * WORD_SIZE + offset)
    }

    // all values (including literals) are allocated on the heap.

    // We allocate canonical values for
    // true, false, undefined, null, and unassigned
    // and make sure no such values are created at runtime

    // boolean values carry their value (0 for false, 1 for true)
    // in the byte following the tag
    is_False(address: number) {
        return this.get_tag(address) === False_tag
    }
    is_True(address: number) {
        return this.get_tag(address) === True_tag
    }
    is_Boolean(address: number) {
        return this.is_True(address) || this.is_False(address)
    }
    is_Null(address: number) {
        return this.get_tag(address) === Null_tag
    }
    is_Unassigned(address: number) {
        return this.get_tag(address) === Unassigned_tag
    }
    is_Undefined(address: number) {
        return this.get_tag(address) === Undefined_tag
    }

    // builtins: builtin id is encoded in second byte
    // [1 byte tag, 1 byte id, 3 bytes unused, 2 bytes #children, 1 byte unused]
    // Note: #children is 0
    is_Builtin(address: number) {
        return this.get_tag(address) === Builtin_tag
    }
    allocate_Builtin(id: number) {
        const address = this.allocate(Builtin_tag, 1)
        this.set_byte_at_offset(address, 1, id)
        return address
    }
    get_Builtin_id(address: number) {
        return this.get_byte_at_offset(address, 1)
    }

    // closure
    // [1 byte tag, 1 byte arity, 2 bytes pc, 1 byte unused, 2 bytes #children, 1 byte unused]
    // followed by the address of env
    // note: currently bytes at offset 4 and 7 are not used;
    //   they could be used to increase pc and #children range
    allocate_Closure(arity: number, pc: number, env: number) {
        const address = this.allocate(Closure_tag, 2)
        this.set_byte_at_offset(address, 1, arity)
        this.set_2_bytes_at_offset(address, 2, pc)
        this.set(address + 1, env)
        return address
    }
    get_Closure_arity(address: number) {
        return this.get_byte_at_offset(address, 1)
    }
    get_Closure_pc(address: number) {
        return this.get_2_bytes_at_offset(address, 2)
    }
    get_Closure_environment(address: number) {
        return this.get_child(address, 0)
    }
    is_Closure(address: number) {
        return this.get_tag(address) === Closure_tag
    }

    // block frame
    // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
    allocate_Blockframe(env: number) {
        const address = this.allocate(Blockframe_tag, 2)
        this.set(address + 1, env)
        return address
    }
    get_Blockframe_environment(address: number) {
        return this.get_child(address, 0)
    }
    is_Blockframe(address: number) {
        return this.get_tag(address) === Blockframe_tag
    }

    // call frame
    // [1 byte tag, 1 byte unused, 2 bytes pc, 1 byte unused, 2 bytes #children, 1 byte unused]
    // followed by the address of env
    allocate_Callframe(env: number, pc: number) {
        const address = this.allocate(Callframe_tag, 2)
        this.set_2_bytes_at_offset(address, 2, pc)
        this.set(address + 1, env)
        return address
    }
    get_Callframe_environment(address: number) {
        return this.get_child(address, 0)
    }
    get_Callframe_pc(address: number) {
        return this.get_2_bytes_at_offset(address, 2)
    }
    is_Callframe(address: number) {
        return this.get_tag(address) === Callframe_tag
    }

    // environment frame
    // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
    // followed by the addresses of its values
    allocate_Frame(number_of_values: number) {
        return this.allocate(Frame_tag, number_of_values + 1)
    }
    display_Frame(address: number) {
        console.log("", "Frame:")
        const size = this.get_number_of_children(address)
        console.log(size, "frame size:")
        for (let i = 0; i < size; i++) {
            console.log(i, "value address:")
            const value = this.get_child(address, i)
            console.log(value, "value:")
            console.log(word_to_string(value), "value word:")
        }
    }

    // environment
    // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
    // followed by the addresses of its frames
    allocate_Environment(number_of_frames: number) {
        return this.allocate(Environment_tag, number_of_frames + 1)
    }

    // access environment given by address using a "position", i.e. a pair of
    // frame index and value index
    get_Environment_value(env_address: number, position: [number, number]) {
        const [frame_index, value_index] = position
        const frame_address = this.get_child(env_address, frame_index)
        return this.get_child(frame_address, value_index)
    }
    set_Environment_value(env_address: number, position: [number, number], value: number) {
        const [frame_index, value_index] = position
        const frame_address = this.get_child(env_address, frame_index)
        this.set_child(frame_address, value_index, value)
    }

    // extend a given environment by a new frame:
    // create a new environment that is bigger by 1
    // frame slot than the given environment.
    // copy the frame Addresses of the given
    // environment to the new environment.
    // enter the address of the new frame to end
    // of the new environment
    extend_Environment(frame_address: number, env_address: number) {
        const old_size = this.get_size(env_address)
        const new_env_address = this.allocate_Environment(old_size)
        let i: number
        for (i = 0; i < old_size - 1; i++) {
            this.set_child(
                new_env_address, i,
                this.get_child(env_address, i))
        }
        this.set_child(new_env_address, i, frame_address)
        return new_env_address
    }

    // for debuggging: display environment
    display_Environment(env_address: number) {
        const size = this.get_number_of_children(env_address)
        console.log("", "Environment:")
        console.log(size, "environment size:")
        for (let i = 0; i < size; i++) {
            console.log(i, "frame index:")
            const frame = this.get_child(env_address, i)
            console.log(frame)
        }
    }

    // pair
    // [1 byte tag, 4 bytes unused, 2 bytes #children, 1 byte unused]
    // followed by head and tail addresses, one word each
    allocate_Pair(hd: number, tl: number) {
        const pair_address = this.allocate(Pair_tag, 3)
        this.set_child(pair_address, 0, hd)
        this.set_child(pair_address, 1, tl)
        return pair_address
    }
    is_Pair(address: number) {
        return this.get_tag(address) === Pair_tag
    }

    // number
    // [1 byte tag, 4 bytes unused,
    //  2 bytes #children, 1 byte unused]
    // followed by the number, one word
    // note: #children is 0
    allocate_Number(n: number) {
        const number_address = this.allocate(Number_tag, 2)
        this.set(number_address + 1, n)
        return number_address
    }
    is_Number(address: number) {
        return this.get_tag(address) === Number_tag
    }

    allocate_Mutex(n : number) {
        const mutex_address = this.allocate(Mutex_tag, 2);
        this.set_child(mutex_address, 0, n);
        return mutex_address
    }

    is_Mutex(address : number) {
        return this.get_tag(address) === Mutex_tag
    }

    // conversions between addresses and JS_value
    address_to_JS_value(x: number) {
        return this.is_Boolean(x)
            ? (this.is_True(x) ? true : false)
            : this.is_Number(x)
            ? this.get(x + 1)
            : this.is_Mutex(x)
            ? new Mutex(this.get_child(x, 0))
            : this.is_Undefined(x)
            ? undefined
            : this.is_Unassigned(x)
            ? "<unassigned>"
            : this.is_Null(x)
            ? null
            : this.is_Pair(x)
            ? [
                this.address_to_JS_value(this.get_child(x, 0)),
                this.address_to_JS_value(this.get_child(x, 1))
                ]
            : this.is_Closure(x)
            ? "<closure>"
            : this.is_Builtin(x)
            ? "<builtin>"
            : "unknown word tag: " + word_to_string(x)
    }
}
