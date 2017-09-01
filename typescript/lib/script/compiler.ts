import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";

export function compile(entry: string, outDir: string, config: string | ts.CompilerOptions): string[] {

    // get the compiler options, either tsconfig.json or compiler options object
    const compilerOptions: ts.CompilerOptions = (typeof config === "string" ?
        JSON.parse(fs.readFileSync(path.resolve(config)).toString()).compilerOptions : config);

    // @todo better conversion of compiler options
    compilerOptions.moduleResolution = ts.ModuleResolutionKind.NodeJs;
    if ((compilerOptions.moduleResolution as any) !== "node") {
        compilerOptions.moduleResolution = ts.ModuleResolutionKind.Classic;
    }
    compilerOptions.listEmittedFiles = true;
    compilerOptions.target = ts.ScriptTarget.ES5;
    compilerOptions.outDir = path.resolve(outDir);
    const program: ts.Program = ts.createProgram([entry], compilerOptions);
    return program.emit().emittedFiles;
}

export function compileToString(filePath: string): string {
    const contents: string = fs.readFileSync(filePath).toString();
    const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES5
    };

    const outputs: any[] = [];

    const compilerHost: ts.CompilerHost = {
        getSourceFile: (filename) => {
            if (filename === "template.ts") {
                return ts.createSourceFile(filename, contents, compilerOptions.target, false);
            }
            return undefined;
        },
        writeFile: (name, text, writeByteOrderMark) => {
            outputs.push({name, text, writeByteOrderMark});
        },
        fileExists: () => true,
        getDefaultLibFileName: (options: ts.CompilerOptions) => "lib.d.ts",
        useCaseSensitiveFileNames: () => false,
        getCanonicalFileName: (filename) => filename,
        getCurrentDirectory: () => "",
        getNewLine: () => "\n"
    } as any;

    ts.createProgram(["template.ts"], compilerOptions, compilerHost).emit();

    return outputs[0].text;
}
