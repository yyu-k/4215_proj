# go-slang

## Grammar

### Completed

- Blocks
- Constant/variable declarations, reassignments
- Function calls
- `if`/`else`/`else if` statements, including the optional simple statement
- Expression statements
- `go` statements
- `for` statements of the following form:
    - for init; condition; post, and any variant thereof with 2 semicolons and missing one or more of the 3 statements/expressions
    - for condition
- function declarations, returns, arity checks
- Implicit blocks are adhered to for `if`, `for`, and universe blocks: https://go.dev/ref/spec#Blocks 

### Todo

- continue and break
- Strings
- Types
- Fix the compilation of the 'log' tag - should not work even in the original vm
- What are the value producing statements in golang
- Make constant declarations constant - this will require changing the compiler and VM
- Declaration of multiple variables in the same line;
- Immediate nested blocks? {{}}
- should we remove pair code?
- lambdas 

## Implementation Notes

- Golang has no ternary operator: https://go.dev/doc/faq#Does_Go_have_a_ternary_form
- while loops are a type of for loops in Golang: https://go.dev/tour/flowcontrol/3
- String Literals are implemented on the basis that "" is the standard string, `` allows for new line characters, and '' is a single rune (the unicode code point of the character) https://yuminlee2.medium.com/golang-double-single-and-back-quotes-a347622e8081#cfa9
- Attempts to assign keytokens are a form of parse error
- Precedence follows the specifications, but bitwise operators are not implemented: https://go.dev/ref/spec#Operators
- Mutexes are not associated with any particular routine - they can unlock each other's mutex. https://pkg.go.dev/sync#Mutex.Unlock 
- +=, -=, ++, -- are not implemented
- WaitGroups and Mutexes are indistinguishable from each other, so illegal operations can be performed using methods meant for the other. 
- This aspect of golang is not followed - only lamdas are allowed in functions, not function definitions: https://stackoverflow.com/questions/21961615/what-are-the-problems-that-are-mitigated-by-not-allowing-nested-function-declara
- There is a complication relating to the operation of continue and the post statement. If the continue simply jumps to the start of the while block, the post statement will not be executed if the post statement is simply appended to the end of the body (initial implementation). Changes to the post statement implementation is therefore required. 
- In Go, an array can be initialized, partially initialized, or not initialized. If an array is not initialized, the elements of the array will take the default value of the array data type. For int, the default is 0 and for string it is "". This is NOT implemented. Instead, array values are initialized to null. 
- Slice implementation differs from https://go.dev/blog/slices-intro: 1) arrays are never exposed to the user to simplify accessing and modification. Instead, all attempts to refer to an array will result in a reference to a slice with the same length and capacity as the array; 2) The pointer of the slice doesn't point to an element of the array, but rather the tag of the array. This necessitates knowing the start index of the slice. 
- Parser cannot achieve something like - function()[2] - this type of recursiveness is not straightforward in peggy. (function())[2] works though (need brackets)
- nil slices are not implemented - see https://go.dev/tour/moretypes/12
- making a slice with the make syntax specifically is not implemented - see https://go.dev/tour/moretypes/13. 
    - a := make([]int, 5) is equivalent to var a[5], which returns a slice of length 5
    - b := make([]int, 0, 5) is equivalent to var a[5], a = a[:0], which returns a slice of length 0 but capacity 5