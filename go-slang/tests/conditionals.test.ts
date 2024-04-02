import { parser } from '../parser/parser';
import { compile_program } from '../compiler';
import { run } from '../global-machine';

const heap_size = 50000
const compile_and_run = (program_str : string) => {
    const ast = parser.parse(program_str);
    const instructions = compile_program(ast) ;
    // TODO: check that output is correct
    const [_output, final_value] = run(instructions, heap_size)
    return final_value
}

describe('if statements should work', () => {
    test('if block should execute if predicate is true', () => {
        const program1 = `{
                        x := 0;
                        if (5 > 3) {
                            x = 5;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(5);
    });
    test('if block should not execute if predicate is false', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 5;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(0);
    });
});

describe('if statements + else statements should work', () => {
    test('else block should execute if predicate is false', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 6;
                        } else {
                            x = 7;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(7);
    });
    test('if block should execute if predicate is true', () => {
        const program1 = `{
                        x := 0;
                        if (5 > 3) {
                            x = 6;
                        } else {
                            x = 7;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(6);
    });
});

describe('if statements + else if statements should work', () => {
    test('if block should execute if predicate is true', () => {
        const program1 = `{
                        x := 0;
                        if (5 > 3) {
                            x = 6;
                        } else if 5 == 5 {
                            x = 7;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(6);
    });
    test('else if block should execute if predicate for if is false, for else if is true', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 6;
                        } else if 5 == 5 {
                            x = 7;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(7);
    });
    test('neither if block nor else if block should execute if both blocks are false', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 6;
                        } else if 5 != 5 {
                            x = 7;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(0);
    });
});


describe('if statements + else if statements + else statements should work', () => {
    test('if block should execute if predicate is true', () => {
        const program1 = `{
                        x := 0;
                        if (5 > 3) {
                            x = 6;
                        } else if 5 == 5 {
                            x = 7;
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(6);
    });
    test('else if block should execute if predicate for if is false, for else if is true', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 6;
                        } else if 5 == 5 {
                            x = 7;
                        } else {
                            x = 9;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(7);
    });
    test('else block should execute when both if block and else if block have false predicates', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 6;
                        } else if 5 != 5 {
                            x = 7;
                        } else {
                            x = 9;
                        }
                        x;
                        }`
        expect(compile_and_run(program1)).toBe(9);
    });
});

describe('multiple else if statements should work', () => {
    test('the first if/else if block with a true predicate should execute', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 6;
                        } else if 5 == 5 {
                            x = 7;
                        } else if 6 > 2 {
                            x = 11;
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(7);
    });
    test('a subsequent else if block will execute if its predicate is true, and the earlier predicates are not', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            x = 6;
                        } else if 5 == 7 {
                            x = 7;
                        } else if 6 > 2 {
                            x = 11;
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(11);
    });
});

describe('nested if statements should work', () => {
    test('nesting if else within if', () => {
        const program1 = `{
                        x := 0;
                        if (5 > 3) {
                            if (6 < 9) {
                                x = 15;
                            } else {
                                x = 17;
                            }
                        } else if 5 == 5 {
                            x = 7;
                        } else if 6 > 2 {
                            x = 11;
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(15);
    });
    test('nesting if else within else if', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            if (6 < 9) {
                                x = 15;
                            } else {
                                x = 17;
                            }
                        } else if 5 == 5 {
                            if (6 < 9) {
                                x = 18;
                            } else {
                                x = 19;
                            }
                        } else if 6 > 2 {
                            x = 11;
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(18);
    });
    test('nesting if else within else ', () => {
        const program1 = `{
                        x := 0;
                        if (5 < 3) {
                            if (6 < 9) {
                                x = 15;
                            } else {
                                x = 17;
                            }
                        } else if 5 > 5 {
                            if (6 < 9) {
                                x = 18;
                            } else {
                                x = 19;
                            }
                        } else {
                            if (6 > 9) {
                                x = 199;
                            } else {
                                x = 200;
                            }
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(200);
    });
});

describe('optional simple statement can be added before the predicate', () => {
    test('simple statement can declare a variable used as predicate', () => {
        const program1 = `{
                        x := 0;
                        if const y = 5; y > 3 {
                            if (6 < 9) {
                                x = 15;
                            } else {
                                x = 17;
                            }
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(15);
    });
    test('variables declared in simple statement are not accessible outside', () => {
        const program1 = `{
                        x := 0;
                        if const x = 5; x > 3 {
                            if (6 < 9) {
                                x = 15;
                            } else {
                                x = 17;
                            }
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(0);
    });
    test('else if statement can use a simple statement as well', () => {
        const program1 = `{
                        x := 0;
                        if const y = 1; y > 3 {
                            x = 7;
                        } else if q := 3; (q == 3) {
                            x = 13;
                        } else {
                            x = 9;
                        }
                        x;
                    }`
        expect(compile_and_run(program1)).toBe(13);
    });
});
