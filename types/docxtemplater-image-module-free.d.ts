declare module "docxtemplater-image-module-free" {
  interface OpcionesImagen {
    centered?: boolean
    getImage: (valor: unknown, etiqueta: string) => Buffer | Promise<Buffer>
    getSize: (imagen: Buffer, valor: unknown, etiqueta: string) => [number, number] | Promise<[number, number]>
  }
  export default class ImageModule {
    constructor(opciones: OpcionesImagen)
  }
}
