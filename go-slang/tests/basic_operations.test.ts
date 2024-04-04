import { parser } from '../parser/parser';
import { compile_program } from '../compiler';
import { run } from '../scheduler';

const heap_size = 50000
const compile_and_run = (program_str : string) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    return run(instructions, heap_size)
}

describe('Arity of function call must be identical to Closure arity', () => {
    test('A user defined function call should execute if the number of arguments is equivalent to that in the Closure', () => {
        const program1 = `
                        func add(a, b) {
                            return a + b;
                        }
                        add(5, 10);
                        `
        const result = compile_and_run(program1)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 15])
    });
    test('A user defined function call should throw if the number of arguments is more than that in the Closure', () => {
        const program1 = `
                        func add(a, b) {
                            return a + b;
                        }
                        add(5, 10, 15);
                        `
        const wrapper = () => compile_and_run(program1)
        expect(wrapper).toThrow();
    });
    test('A user defined function call should throw if the number of arguments is less than that in the Closure', () => {
        const program1 = `
                        func add(a, b) {
                            return a + b;
                        }
                        add(5);
                        `
        const wrapper = () => compile_and_run(program1)
        expect(wrapper).toThrow();
    });
    test('A builtin function call should execute if the number of arguments is equivalent to that in the Closure', () => {
        const program1 = `
                        pa := pair(3,4);
                        head(pa);
                        `
        const result = compile_and_run(program1)
        expect(result).toHaveLength(1)
        expect(result[0]).toStrictEqual([[], 3])
    });
    test('A builtin function call should throw if the number of arguments is more than that in the Closure', () => {
        const program1 = `
                        pa := pair(3,4);
                        head(pa, 5);
                        `
        const wrapper = () => compile_and_run(program1)
        expect(wrapper).toThrow();
    });
    test('A user defined function call should throw if the number of arguments is less than that in the Closure', () => {
        const program1 = `
                        pa := pair(3,4);
                        head();
                        `
        const wrapper = () => compile_and_run(program1)
        expect(wrapper).toThrow();
    });
    }
)