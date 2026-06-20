declare module 'fit-file-parser' {
  export interface FitParserOptions {
    force?: boolean;
    speedUnit?: 'm/s' | 'km/h' | 'mph';
    lengthUnit?: 'm' | 'km' | 'mile';
    temperatureUnit?: 'celsius' | 'fahrenheit';
    mode?: 'cascade' | 'list' | 'both';
  }

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(
      content: ArrayBuffer | Buffer,
      callback: (error: string | null, data: any) => void
    ): void;
  }
}
