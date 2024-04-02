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

describe('functions should be definable', () => {
    test('func add(a, b) {return a + b;} add(10,15) should give 25', () => {
        const program1 = `{
                        func add(a, b) {
                            return a + b;
                        }
                        add(10, 15);
                        }`
        expect(compile_and_run(program1)).toBe(25);
    });
});

describe('methods should be definable', () => {
    test('func (i) add(a) {return i + a;} d:=10; d.add(15) should give 25', () => {
        const program1 = `{
                        func (i) add(a) {
                            return i + a;
                        }
                        d := 10;
                        d.add(15);
                        }`
        expect(compile_and_run(program1)).toBe(25);
    });
});




