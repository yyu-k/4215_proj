import { Heap } from './heap'
import { Machine } from './machine'
import { arity, error } from './utilities'
import { mutex_builtins, waitGroup_builtins } from './mutex_builtins'


// the builtins take their arguments directly from the operand stack,
// to save the creation of an intermediate argument array
type BuiltinFunction = (machine: Machine, heap: Heap, ...args: unknown[]) => unknown
// important: always keep the arity in sync with the number of arguments passed to the function
const builtin_implementation: Record<string, BuiltinFunction> = {
    display       : (machine, heap, _) => {
                        const address = machine.OS.pop()!
                        machine.output.push(heap.address_to_JS_value(address))
                        return address
                    },
    error         : (machine, heap, _) => error(heap.address_to_JS_value(machine.OS.pop()!)),
    pair          : (machine, heap, _hd, _tl) => {
                        const tl = machine.OS.pop()!
                        const hd = machine.OS.pop()!
                        return heap.allocate_Pair(hd, tl)
                    },
    is_pair       : (machine, heap, _) => heap.is_Pair(machine.OS.pop()!) ? heap.values.True : heap.values.False,
    head          : (machine, heap, _) => heap.get_child(machine.OS.pop()!, 0),
    tail          : (machine, heap, _) => heap.get_child(machine.OS.pop()!, 1),
    is_null       : (machine, heap, _) => heap.is_Null(machine.OS.pop()!) ? heap.values.True : heap.values.False,
    set_head      : (machine, heap, _p, _val) => {
                        const val = machine.OS.pop()!
                        const p = machine.OS.pop()!
                        heap.set_child(p, 0, val)
                    },
    set_tail      : (machine, heap, _p, _val) => {
                        const val = machine.OS.pop()!
                        const p = machine.OS.pop()!
                        heap.set_child(p, 1, val)
                    }
}

export const builtins : Record<string, {tag : string, id: number, arity : number}> = {}
export const builtin_array: BuiltinFunction[] = []
const all_builtins = {...waitGroup_builtins , ...mutex_builtins, ...builtin_implementation}
{
    let i = 0
    for (const key in all_builtins) {
        builtins[key] =
            {
                tag:   'BUILTIN',
                id:    i,
                // actual function length minus 2 since the first two arguments are the machine and the heap
                arity: arity(all_builtins[key]) - 2
            }
        builtin_array[i++] = all_builtins[key]
    }
}

export const constants = {
    // `allocate_constant_frame` sets this up
    undefined     : undefined
}
