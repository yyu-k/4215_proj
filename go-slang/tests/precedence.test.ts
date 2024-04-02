import { parser } from '../parser/parser';
import { compile_program, run } from '../vm';

const heap_size = 50000
const compile_and_run = (program_str : string) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    return run(instructions, heap_size);
} 

describe('Multiplication/Division should have a higher precendence than addition/subtraction', () => {
    test('3 * 5 + 2 should be 17', () => {
        const program1 = "{3 * 5 + 2;}"
        expect(compile_and_run(program1)).toBe(17);
    });
    test('3 + 5 / 2 should be 5.5', () => {
        const program1 = "{3 + 5 / 2;}"
        expect(compile_and_run(program1)).toBe(5.5);
    });
    test('3 * 5 - 2 should be 13', () => {
        const program1 = "{3 * 5 - 2;}"
        expect(compile_and_run(program1)).toBe(13);
    });
    test('3 - 5 / 2 should be 0.5', () => {
        const program1 = "{3 - 5 / 2;}"
        expect(compile_and_run(program1)).toBe(0.5);
    });
    test('3 + 5 * 2 - 7 + 3 / 6 should be 6.5', () => {
        const program1 = "{3 + 5 * 2 - 7 + 3 / 6;}"
        expect(compile_and_run(program1)).toBe(6.5);
    });
});

describe('Addition/Subtraction should have a higher precendence than relative operators', () => {
    test('3 + 2 == 1 + 1 should be false', () => {
        const program1 = "{3 + 2 == 1 + 1;}"
        expect(compile_and_run(program1)).toBe(false);
    });
    test('3 + 7 > 9 - 1 should be true', () => {
        const program1 = "{3 + 7 > 9 - 1;}"
        expect(compile_and_run(program1)).toBe(true);
    });
    test('4 * 4 >= 32 / 2  should be true', () => {
        const program1 = "{4 * 4 >= 32 / 2;}"
        expect(compile_and_run(program1)).toBe(true);
    });
    test('3-5 == 3 + -5 should be true', () => {
        const program1 = "{3-5 == 3 + -5;}"
        expect(compile_and_run(program1)).toBe(true);
    });
    test('4 * 3 + 2 > 2 * 3 + 8 should be false', () => {
        const program1 = "{4 * 3 + 2 > 2 * 3 + 8;}"
        expect(compile_and_run(program1)).toBe(false);
    });
});

describe('Groups i.e. () have the highest precedence', () => {
    test('(2 + 2) * 3 should be 12', () => {
        const program1 = "{(2 + 2) * 3;}"
        expect(compile_and_run(program1)).toBe(12);
    });
    test('(14 * 2 >= 2 + 27) == (true == false) should be true', () => {
        const program1 = "{(14 * 2 >= 2 + 27) == (true == false);}"
        expect(compile_and_run(program1)).toBe(true);
    });
    test('(3 + 5) * (2 - 7) + 3 / 6 should be -39.5', () => {
        const program1 = "{(3 + 5) * (2 - 7) + 3 / 6;}"
        expect(compile_and_run(program1)).toBe(-39.5);
    });
});




