import { parser } from '../parser/parser';
import { compile_program } from '../compiler';
import { run } from '../scheduler';

const heap_size = 50000
const compile_and_run = (program_str : string) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    return run(instructions, heap_size)
}

describe('program', () => {
    test('should be executable without a block', () => {
        const program = `
            a := 1;
            a;
        `
        const result = compile_and_run(program)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 1])
    })

    test('should be executable with a block', () => {
        const program = `{
            a := 1;
            a;
        }`
        const result = compile_and_run(program)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 1])
    });
})

describe('statements', () => {
    test('do not require semicolons', () => {
        const program = `
            func add(a, b) {
                result := a + b
                return result
            }
            a := 1
            b := 2
            add(a, b)
        `
        const result = compile_and_run(program)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 3])
    })

    test('error when multiple statements are on the same line without semicolons', () => {
        const program = `
            a := 1 b := 2
            a + b
        `
        expect(() => parser.parse(program)).toThrow()
    })

    test('do not error when multiple statements are on the same line with semicolons', () => {
        const program = `
            a := 1; b := 2
            a + b
        `
        const result = compile_and_run(program)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 3])
    })

    test('do not error when empty statements are on the same line', () => {
        const program = `
            a := 1; ; ;;
            a
        `
        const result = compile_and_run(program)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 1])
    })
})
