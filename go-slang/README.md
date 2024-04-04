# go-slang

## Grammar

### Completed

- Blocks
- Constant/variable declarations, reassignments
- Function calls
- `if`/`else`/`else if` statements, including the optional simple statement
- Expression statements
- `for` statements of the following form:
    - for init; condition; post, and any variant thereof with 2 semicolons and missing one or more of the 3 statements/expressions
    - for condition
- function declarations, returns
- Implicit blocks are adhered to for `if` and `for` blocks: https://go.dev/ref/spec#Blocks 

### Todo
- Universe block (instead of manual `{` and `}` for each program string)
- continue and break
- `go` statements
- Types
- Fix the compilation of the 'log' tag - should not work even in the original vm

## Todo

- Make constant declarations constant - this will require changing the compiler and VM
- Declaration of multiple variables in the same line;
- Immediate nested blocks? {{}}
- The definition of sequence is a bit odd in the grammar because Blocks and IfStatement have no EOS, but other statements do
- arity of function calls is unchecked - it is possible to pass 2 arguments to a function that accepts 1, and vice-versa

## Implementation Notes

- Golang has no ternary operator: https://go.dev/doc/faq#Does_Go_have_a_ternary_form
- while loops are a type of for loops in Golang: https://go.dev/tour/flowcontrol/3
- String Literals are implemented on the basis that "" is the standard string, `` allows for new line characters, and '' is a single rune (the unicode code point of the character) https://yuminlee2.medium.com/golang-double-single-and-back-quotes-a347622e8081#cfa9
- Attempts to assign keytokens are a form of parse error
- Precedence follows the specifications, but bitwise operators are not implemented: https://go.dev/ref/spec#Operators
- Mutexes are not associated with any particular routine - they can unlock each other's mutex. https://pkg.go.dev/sync#Mutex.Unlock 
- +=, -=, ++, -- are not implemented
- WaitGroups and Mutexes are indistinguishable from each other, so illegal operations can be performed using methods meant for the other. 
