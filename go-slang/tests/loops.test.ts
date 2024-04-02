import { parser } from '../parser/parser';
import { compile_program, run } from '../vm';

const heap_size = 50000
const compile_and_run = (program_str : string) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    return run(instructions, heap_size);
} 

describe('for loops with init statement, condition, and post statement should work', () => {
    test('adding a number every loop', () => {
        const program1 = `{
                            x := 0;
                            for i:=0; i<10; i = i + 1 {
                                x = x + 1;
                            }
                            x;
                        }`
        expect(compile_and_run(program1)).toBe(10);
    });
    test('For loop can have an empty body', () => {
        const program1 = `{
                            x := 0;
                            for i:=0; i<10; i = i + 1 {
                            }
                            x;
                        }`
        expect(compile_and_run(program1)).toBe(0);
    });
});

describe('for loops with init statement, condition, and no post statement should work', () => {
    test('adding to init variable within the for loop instead of using the post statement', () => {
        const program1 = `{
                            x := 0;
                            for i:=0; i<10; {
                                x = x + 1;
                                i = i + 2;
                            }
                            x;
                        }`
        expect(compile_and_run(program1)).toBe(5);
    });
});

describe('for loops with condition, no init statement and no post statement should work', () => {
    test('condition only, 2 semicolons', () => {
        const program1 = `{
                            x := 0;
                            i := 0;
                            for ;i<10; {
                                x = x + 1;
                                i = i + 2;
                            }
                            x;
                        }`
        expect(compile_and_run(program1)).toBe(5);
    });
    test('condition only, no semicolons', () => {
        const program1 = `{
                            x := 0;
                            i := 0;
                            for i<10 {
                                x = x + 1;
                                i = i + 2;
                            }
                            x;
                        }`
        expect(compile_and_run(program1)).toBe(5);
    });
});

describe('variables declared by the init statement should not be accessible outside the loop', () => {
    test('attempting to access variables declared by the init statement should throw', () => {
        const program1 = `{
                            x := 0;
                            for i:=0; i<10; i = i + 1 {
                                x = x + 1;
                            }
                            i;
                        }`
        const wrapper = () => compile_and_run(program1);
        expect(wrapper).toThrow(TypeError);
    });
});







