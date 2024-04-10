import { parser } from '../parser/parser';
import { compile_program } from '../compiler';
import { run } from '../scheduler';

const heap_size = 50000
const compile_and_run = (program_str : string) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    return run(instructions, heap_size)
}

describe('arrays', () => {
    test('Can be declared via var, initialized with null, and accessed', () => {
        const result = compile_and_run(`
            var a[3] string
            a[0]
        `)
        expect(result[0]).toStrictEqual([[], null])
    });
    test('Can be declared via short assignment directly using literals', () => {
        const result = compile_and_run(`
            primes := [6]int{2, 3, 5, 7, 11, 13}
            primes[3]
        `)
        expect(result[0]).toStrictEqual([[], 7])
    });
    test('Can be declared via short assignment directly using expressions', () => {
        const result = compile_and_run(`
            func number() {
                return 200
            }
            nums := [6]int{2, number(), 5, 9, 11 + 7, 13 * 2}
            nums[1]
        `)
        expect(result[0]).toStrictEqual([[], 200])
    });
    test('Can be declared via short assignment where the number of expressions < size', () => {
        const result = compile_and_run(`
            nums := [6]int{1}
            nums[0]
        `)
        expect(result[0]).toStrictEqual([[], 1])
    });
    test('Can be assigned to other literals', () => {
        const result = compile_and_run(`
            var a[3] string 
            a[0] = "haha"
            a[0]
        `)
        expect(result[0]).toStrictEqual([[], "haha"])
    });
    test('Can be assigned to other expressions', () => {
        const result = compile_and_run(`
            func add(a, b) {
                return a + b;
            }
            var a[3] string 
            a[0] = add(3, 7)
            a[0]
        `)
        expect(result[0]).toStrictEqual([[], 10])
    });
    test('Does not allow access to index outside the size range', () => {
        const wrapper = () => compile_and_run(`
                var a[3] string 
                a[3] = add(3, 7)
            `)
        expect(wrapper).toThrow()
    });
    test('Allows expressions to be used to define the size', () => {
        const result = compile_and_run(`
                func add(a, b) {
                    return a + b;
                }
                var a[add(3,2)] string 
                a[4] = add(3, 7)
                a[4]
            `)
        expect(result[0]).toStrictEqual([[], 10])
    });
    test('Indexes can be a variable e.g. in loops', () => {
        const result = compile_and_run(`
                var a[5] string 
                for i := 0; i < 5; i = i + 1 {
                    a[i] = i * 2;
                }
                a[2] + a[3] + a[4];
            `)
        expect(result[0]).toStrictEqual([[], 18])
    });
    test('can be returned by functions', () => {
        const result = compile_and_run(`
                func array_return(rounds) {
                    var a[rounds] string 
                    for i := 0; i < rounds; i = i + 1 {
                        a[i] = i * 2;
                    }
                    return a
                }
                z := array_return(11)
                z[10]
            `)
        expect(result[0]).toStrictEqual([[], 20])
    });
    test('can be directly accessed as an expression if the expression is bracketed', () => {
        const result = compile_and_run(`
                func array_return(rounds) {
                    var a[rounds] string 
                    for i := 0; i < rounds; i = i + 1 {
                        a[i] = i * 2;
                    }
                    return a
                }
                (array_return(11))[10]
            `)
        expect(result[0]).toStrictEqual([[], 20])
    });
})
