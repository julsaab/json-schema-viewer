import React, { useEffect } from 'react';
import { JsonSchema } from './schema';
import Editor, { OnValidate, useMonaco } from '@monaco-editor/react';
import Ajv from 'ajv/dist/2020';
import { editor, IRange } from 'monaco-editor';
import { ScrollType, MarkerSeverity } from './monaco-helpers';

interface SourceLocation {
  line: number;
  column: number;
  position: number;
}

export type SchemaEditorProps = {
  initialContent: unknown;
  schema: JsonSchema;
  validationRange?: IRange;
  onValidate: OnValidate;
};


export const SchemaEditor: React.FC<SchemaEditorProps> = (props) => {
  const { initialContent, schema, validationRange, onValidate } = props;
  const monaco = useMonaco();
  const ajv = new Ajv({
    allErrors: true,  // do not bail, optional
    jsPropertySyntax: true  // totally needed for this
  });
  const validate = ajv.compile(schema);
  let jsonSourceMap = require('json-source-map');
  let timeoutId: any = undefined;

  useEffect(() => {
    monaco?.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: false,
      allowComments: false,
      schemas: [
        {
          uri: 'https://json-schema.app/example.json', // id of the first schema
          fileMatch: ['a://b/example.json'],
          schema: schema
        }
      ]
    });
  }, [monaco, schema]);
  useEffect(() => {
    if (!validationRange || !monaco) {
      return;
    }
    monaco.editor.getEditors().forEach((codeEditor) => {
      codeEditor.setSelection(validationRange);
      codeEditor.revealRangeAtTop(validationRange, ScrollType.Smooth);
    });
  }, [monaco, validationRange]);


  return (
    <Editor
      height="97vh"
      defaultLanguage="json"
      value={/*editorPreamble + '\n' + */JSON.stringify(initialContent, null, 2)}
      path="a://b/example.json"
      theme="vs-dark"
      saveViewState={false}
      onChange={(value) => {

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
          if (value) {
            try {
              const sourceMap = jsonSourceMap.parse(value);
              const valid = validate(sourceMap.data);
              const validationResults: editor.IMarker[] = [];
              if (!valid && validate.errors) {
                // console.log('onChange', validate.errors);
                // console.log('sourceMap', sourceMap);
                // const jsonLines = value.split('\n');


                for (const error of validate.errors) {
                  // console.log('error', error);
                  const propertyPath: string = error.instancePath.replace(/\[/g, '/')
                    .replace(/]/g, '/').replace(/\./g, '/')
                    .replace(/\/\//g, '/');
                  const propertyLocation = sourceMap.pointers[propertyPath];
                  // console.log('val1', propertyPath, propertyLocation);

                  if (!propertyLocation) {
                    continue;
                  }

                  // const propertyLineNumber: string = propertyLocation ? propertyLocation.key.line.toString() : 'unknown';
                  const message: string = `${error.instancePath}  -  ${error.keyword} ${error.message} ${JSON.stringify(error.params)}`;

                  //Adding +1 because the count starts from 0
                  // @ts-ignore
                  const test: editor.IMarker = {
                    owner: 'json',
                    startLineNumber: propertyLocation.key.line + 1,
                    endLineNumber: propertyLocation.keyEnd.line + 1,
                    startColumn: propertyLocation.key.column + 1,
                    endColumn: propertyLocation.keyEnd.column + 1,
                    message: message,
                    severity: MarkerSeverity.Error
                  };

                  validationResults.push(test);
                  // console.log('val2', propertyPath, test);
                }
              }
              onValidate(validationResults);
            } catch (e) {

              // @ts-ignore
              const test: editor.IMarker = {
                owner: 'json',
                startLineNumber: 0,
                endLineNumber: 0,
                startColumn: 0,
                endColumn: 0,
                // @ts-ignore
                message: e.name + ' ' + e.message,
                severity: MarkerSeverity.Error
              };
              onValidate([test]);
            }
          }
        }, 350);
      }}
    />
  );
};
