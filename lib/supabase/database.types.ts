
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "actas": {
                  Row: {
                    "firma_cliente": string | null,"firma_inspector": string | null,"generada_en": string,"id": string,"inspeccion_id": string,"nombre_firma_cliente": string | null,"tenant_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "firma_cliente"?: string | null,"firma_inspector"?: string | null,"generada_en"?: string,"id"?: string,"inspeccion_id": string,"nombre_firma_cliente"?: string | null,"tenant_id": string,"version"?: number
                  }
                  Update: {
                    "firma_cliente"?: string | null,"firma_inspector"?: string | null,"generada_en"?: string,"id"?: string,"inspeccion_id"?: string,"nombre_firma_cliente"?: string | null,"tenant_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "actas_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: true
      referencedRelation: "inspecciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actas_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: true
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actas_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"bitacora": {
                  Row: {
                    "accion": Database["public"]['Enums']["accion_bitacora"],"antes": Json | null,"descripcion": string,"despues": Json | null,"entidad": string,"entidad_id": string,"id": string,"ip": unknown | null,"nivel": string,"tenant_id": string,"timestamp": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accion": Database["public"]['Enums']["accion_bitacora"],"antes"?: Json | null,"descripcion": string,"despues"?: Json | null,"entidad": string,"entidad_id": string,"id"?: string,"ip"?: unknown | null,"nivel"?: string,"tenant_id": string,"timestamp"?: string,"usuario_id"?: string | null
                  }
                  Update: {
                    "accion"?: Database["public"]['Enums']["accion_bitacora"],"antes"?: Json | null,"descripcion"?: string,"despues"?: Json | null,"entidad"?: string,"entidad_id"?: string,"id"?: string,"ip"?: unknown | null,"nivel"?: string,"tenant_id"?: string,"timestamp"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bitacora_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"checklists": {
                  Row: {
                    "creado_en": string,"id": string,"nombre": string,"norma_id": string,"reactivos": NonNullable<Json>,"tenant_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"id"?: string,"nombre": string,"norma_id": string,"reactivos"?: NonNullable<Json>,"tenant_id"?: string,"version": string
                  }
                  Update: {
                    "creado_en"?: string,"id"?: string,"nombre"?: string,"norma_id"?: string,"reactivos"?: NonNullable<Json>,"tenant_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklists_norma_id_fkey"
      columns: ["norma_id"]
isOneToOne: false
      referencedRelation: "normas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklists_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"clientes": {
                  Row: {
                    "contacto": string,"creado_en": string,"email": string,"giro": string,"id": string,"razon_social": string,"rfc": string,"telefono": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contacto": string,"creado_en"?: string,"email": string,"giro": string,"id"?: string,"razon_social": string,"rfc": string,"telefono": string,"tenant_id"?: string
                  }
                  Update: {
                    "contacto"?: string,"creado_en"?: string,"email"?: string,"giro"?: string,"id"?: string,"razon_social"?: string,"rfc"?: string,"telefono"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"dictamenes": {
                  Row: {
                    "aprobado_por": string,"emitido_en": string,"folio": string,"id": string,"inspeccion_id": string,"resultado": Database["public"]['Enums']["resultado_dictamen"],"tenant_id": string,"token_qr": string,"vigente_hasta": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aprobado_por": string,"emitido_en"?: string,"folio": string,"id"?: string,"inspeccion_id": string,"resultado": Database["public"]['Enums']["resultado_dictamen"],"tenant_id": string,"token_qr": string,"vigente_hasta"?: string | null
                  }
                  Update: {
                    "aprobado_por"?: string,"emitido_en"?: string,"folio"?: string,"id"?: string,"inspeccion_id"?: string,"resultado"?: Database["public"]['Enums']["resultado_dictamen"],"tenant_id"?: string,"token_qr"?: string,"vigente_hasta"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dictamenes_aprobado_por_fkey"
      columns: ["aprobado_por"]
isOneToOne: false
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["inspector_id"]
    },{
      foreignKeyName: "dictamenes_aprobado_por_fkey"
      columns: ["aprobado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dictamenes_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: true
      referencedRelation: "inspecciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dictamenes_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: true
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dictamenes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"evidencias": {
                  Row: {
                    "hash": string,"id": string,"inspeccion_id": string,"lat": number | null,"lng": number | null,"nombre": string,"ruta": string | null,"subida_en": string,"tenant_id": string,"tipo": Database["public"]['Enums']["tipo_evidencia"],"tomada_en": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "hash": string,"id"?: string,"inspeccion_id": string,"lat"?: number | null,"lng"?: number | null,"nombre": string,"ruta"?: string | null,"subida_en"?: string,"tenant_id": string,"tipo": Database["public"]['Enums']["tipo_evidencia"],"tomada_en": string,"url"?: string | null
                  }
                  Update: {
                    "hash"?: string,"id"?: string,"inspeccion_id"?: string,"lat"?: number | null,"lng"?: number | null,"nombre"?: string,"ruta"?: string | null,"subida_en"?: string,"tenant_id"?: string,"tipo"?: Database["public"]['Enums']["tipo_evidencia"],"tomada_en"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "evidencias_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: false
      referencedRelation: "inspecciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidencias_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: false
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evidencias_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"folios": {
                  Row: {
                    "anio": number,"tenant_id": string,"ultimo": number
                  }
                  ComputedFields: never
                  Insert: {
                    "anio": number,"tenant_id": string,"ultimo"?: number
                  }
                  Update: {
                    "anio"?: number,"tenant_id"?: string,"ultimo"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "folios_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"ia_solicitudes": {
                  Row: {
                    "creado_en": string,"decidida_en": string | null,"decidida_por": string | null,"decision": string | null,"entidad": string | null,"entidad_id": string | null,"error": string | null,"estado": string,"funcion": string,"id": string,"modelo": string | null,"sugerencia": Json | null,"tenant_id": string,"tokens_entrada": number | null,"tokens_salida": number | null,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"decidida_en"?: string | null,"decidida_por"?: string | null,"decision"?: string | null,"entidad"?: string | null,"entidad_id"?: string | null,"error"?: string | null,"estado"?: string,"funcion": string,"id"?: string,"modelo"?: string | null,"sugerencia"?: Json | null,"tenant_id": string,"tokens_entrada"?: number | null,"tokens_salida"?: number | null,"usuario_id"?: string | null
                  }
                  Update: {
                    "creado_en"?: string,"decidida_en"?: string | null,"decidida_por"?: string | null,"decision"?: string | null,"entidad"?: string | null,"entidad_id"?: string | null,"error"?: string | null,"estado"?: string,"funcion"?: string,"id"?: string,"modelo"?: string | null,"sugerencia"?: Json | null,"tenant_id"?: string,"tokens_entrada"?: number | null,"tokens_salida"?: number | null,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ia_solicitudes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"inspecciones": {
                  Row: {
                    "checklist_id": string,"creado_en": string,"duracion_min": number,"enviada_revision_en": string | null,"estatus": Database["public"]['Enums']["estatus_inspeccion"],"fecha": string,"id": string,"iniciada_en": string | null,"inspector_id": string,"instalacion_id": string,"norma_id": string,"observaciones": string,"respuestas": NonNullable<Json>,"sincronizada_en": string | null,"tenant_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checklist_id": string,"creado_en"?: string,"duracion_min": number,"enviada_revision_en"?: string | null,"estatus"?: Database["public"]['Enums']["estatus_inspeccion"],"fecha": string,"id"?: string,"iniciada_en"?: string | null,"inspector_id": string,"instalacion_id": string,"norma_id": string,"observaciones"?: string,"respuestas"?: NonNullable<Json>,"sincronizada_en"?: string | null,"tenant_id"?: string,"version"?: number
                  }
                  Update: {
                    "checklist_id"?: string,"creado_en"?: string,"duracion_min"?: number,"enviada_revision_en"?: string | null,"estatus"?: Database["public"]['Enums']["estatus_inspeccion"],"fecha"?: string,"id"?: string,"iniciada_en"?: string | null,"inspector_id"?: string,"instalacion_id"?: string,"norma_id"?: string,"observaciones"?: string,"respuestas"?: NonNullable<Json>,"sincronizada_en"?: string | null,"tenant_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspecciones_checklist_id_fkey"
      columns: ["checklist_id"]
isOneToOne: false
      referencedRelation: "checklists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspecciones_inspector_id_fkey"
      columns: ["inspector_id"]
isOneToOne: false
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["inspector_id"]
    },{
      foreignKeyName: "inspecciones_inspector_id_fkey"
      columns: ["inspector_id"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspecciones_instalacion_id_fkey"
      columns: ["instalacion_id"]
isOneToOne: false
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["instalacion_id"]
    },{
      foreignKeyName: "inspecciones_instalacion_id_fkey"
      columns: ["instalacion_id"]
isOneToOne: false
      referencedRelation: "instalaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspecciones_norma_id_fkey"
      columns: ["norma_id"]
isOneToOne: false
      referencedRelation: "normas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inspecciones_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"instalaciones": {
                  Row: {
                    "cliente_id": string,"direccion": string,"id": string,"lat": number,"lng": number,"municipio": string,"nombre": string,"permiso": string,"permiso_vigencia": string | null,"tenant_id": string,"tipo": string,"vencimiento": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cliente_id": string,"direccion": string,"id"?: string,"lat": number,"lng": number,"municipio": string,"nombre": string,"permiso"?: string,"permiso_vigencia"?: string | null,"tenant_id"?: string,"tipo": string,"vencimiento"?: string | null
                  }
                  Update: {
                    "cliente_id"?: string,"direccion"?: string,"id"?: string,"lat"?: number,"lng"?: number,"municipio"?: string,"nombre"?: string,"permiso"?: string,"permiso_vigencia"?: string | null,"tenant_id"?: string,"tipo"?: string,"vencimiento"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "instalaciones_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "instalaciones_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "clientes_resumen"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "instalaciones_cliente_id_fkey"
      columns: ["cliente_id"]
isOneToOne: false
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["cliente_id"]
    },{
      foreignKeyName: "instalaciones_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"normas": {
                  Row: {
                    "clave": string,"id": string,"nota": string | null,"rama": string,"tenant_id": string,"titulo": string,"vigente": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "clave": string,"id"?: string,"nota"?: string | null,"rama": string,"tenant_id"?: string,"titulo": string,"vigente"?: boolean
                  }
                  Update: {
                    "clave"?: string,"id"?: string,"nota"?: string | null,"rama"?: string,"tenant_id"?: string,"titulo"?: string,"vigente"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "normas_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"plantillas": {
                  Row: {
                    "actualizada_en": string,"archivo": string,"campos": (string)[],"id": string,"nombre": string,"tenant_id": string,"tipo": Database["public"]['Enums']["tipo_plantilla"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizada_en"?: string,"archivo": string,"campos"?: (string)[],"id"?: string,"nombre": string,"tenant_id"?: string,"tipo": Database["public"]['Enums']["tipo_plantilla"]
                  }
                  Update: {
                    "actualizada_en"?: string,"archivo"?: string,"campos"?: (string)[],"id"?: string,"nombre"?: string,"tenant_id"?: string,"tipo"?: Database["public"]['Enums']["tipo_plantilla"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "plantillas_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "acreditacion_desde": string,"acreditacion_ema": string,"ciudad": string,"color_primario": string,"creado_en": string,"ia_limite_mensual": number,"id": string,"logo_url": string | null,"nombre_corto": string,"rama": string,"razon_social": string,"serie_folio": string,"sitio_web": string,"slug": string,"vigencia_dictamen_meses": number,"zona_horaria": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acreditacion_desde": string,"acreditacion_ema": string,"ciudad"?: string,"color_primario"?: string,"creado_en"?: string,"ia_limite_mensual"?: number,"id"?: string,"logo_url"?: string | null,"nombre_corto": string,"rama": string,"razon_social": string,"serie_folio": string,"sitio_web"?: string,"slug": string,"vigencia_dictamen_meses"?: number,"zona_horaria"?: string
                  }
                  Update: {
                    "acreditacion_desde"?: string,"acreditacion_ema"?: string,"ciudad"?: string,"color_primario"?: string,"creado_en"?: string,"ia_limite_mensual"?: number,"id"?: string,"logo_url"?: string | null,"nombre_corto"?: string,"rama"?: string,"razon_social"?: string,"serie_folio"?: string,"sitio_web"?: string,"slug"?: string,"vigencia_dictamen_meses"?: number,"zona_horaria"?: string
                  }
                  Relationships: [
                    
                  ]
                },"usuarios": {
                  Row: {
                    "activo": boolean,"competencias": NonNullable<Json>,"creado_en": string,"email": string,"id": string,"iniciales": string,"nombre": string,"rol": Database["public"]['Enums']["rol"],"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"competencias"?: NonNullable<Json>,"creado_en"?: string,"email": string,"id": string,"iniciales": string,"nombre": string,"rol": Database["public"]['Enums']["rol"],"tenant_id": string
                  }
                  Update: {
                    "activo"?: boolean,"competencias"?: NonNullable<Json>,"creado_en"?: string,"email"?: string,"id"?: string,"iniciales"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol"],"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuarios_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "clientes_resumen": {
                  Row: {
                    "busqueda": string | null,"contacto": string,"creado_en": string,"email": string,"giro": string,"id": string,"inspecciones": number | null,"instalaciones": number | null,"razon_social": string,"rfc": string,"telefono": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "busqueda"?: never,"contacto"?: string | null,"creado_en"?: string | null,"email"?: string | null,"giro"?: string | null,"id"?: string | null,"inspecciones"?: never,"instalaciones"?: never,"razon_social"?: string | null,"rfc"?: string | null,"telefono"?: string | null,"tenant_id"?: string | null
                         }
                        Update: {
                           "busqueda"?: never,"contacto"?: string | null,"creado_en"?: string | null,"email"?: string | null,"giro"?: string | null,"id"?: string | null,"inspecciones"?: never,"instalaciones"?: never,"razon_social"?: string | null,"rfc"?: string | null,"telefono"?: string | null,"tenant_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "clientes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"dictamenes_lista": {
                  Row: {
                    "aprobado_por": string,"busqueda": string | null,"cliente": string,"emitido_en": string,"folio": string,"id": string,"inspeccion_id": string,"instalacion": string,"norma": string,"resultado": Database["public"]['Enums']["resultado_dictamen"],"tenant_id": string,"token_qr": string,"vigente_hasta": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "dictamenes_aprobado_por_fkey"
      columns: ["aprobado_por"]
isOneToOne: false
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["inspector_id"]
    },{
      foreignKeyName: "dictamenes_aprobado_por_fkey"
      columns: ["aprobado_por"]
isOneToOne: false
      referencedRelation: "usuarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dictamenes_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: true
      referencedRelation: "inspecciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dictamenes_inspeccion_id_fkey"
      columns: ["inspeccion_id"]
isOneToOne: true
      referencedRelation: "inspecciones_fila"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dictamenes_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"inspecciones_fila": {
                  Row: {
                    "busqueda": string | null,"cliente": string,"cliente_id": string,"estatus": Database["public"]['Enums']["estatus_inspeccion"],"fecha": string,"folio": string | null,"id": string,"inspector": string,"inspector_id": string,"instalacion": string,"instalacion_id": string,"municipio": string,"norma": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "inspecciones_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "aprobar_y_emitir":
{ Args: { "p_id": string,"p_revision_ia"?: Json }; Returns: {
              "aprobado_por": string,
"emitido_en": string,
"folio": string,
"id": string,
"inspeccion_id": string,
"resultado": Database["public"]['Enums']["resultado_dictamen"],
"tenant_id": string,
"token_qr": string,
"vigente_hasta": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "dictamenes"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancelar_inspeccion":
{ Args: { "p_id": string }; Returns: undefined
                           },
"dashboard":
{ Args: { "p_desde": string,"p_hoy_fin": string,"p_hoy_inicio": string,"p_limite_vencimiento": string }; Returns: Json
                           },
"devolver_a_campo":
{ Args: { "p_id": string,"p_motivo": string }; Returns: undefined
                           },
"ia_completar":
{ Args: { "p_error": string | null,"p_id": string,"p_modelo": string,"p_sugerencia": Json | null,"p_tokens_entrada": number | null,"p_tokens_salida": number | null }; Returns: undefined
                           },
"ia_reservar":
{ Args: { "p_funcion": string,"p_tenant": string,"p_usuario": string | null }; Returns: string
                           },
"ia_resolver":
{ Args: { "p_descartar": boolean,"p_entidad": string | null,"p_entidad_id": string | null,"p_final": Json | null,"p_id": string }; Returns: string
                           },
"purgar_datos_tenant":
{ Args: { "p_tenant": string }; Returns: undefined
                           },
"reprogramar_inspeccion":
{ Args: { "p_fecha": string,"p_id": string }; Returns: undefined
                           },
"sincronizar_captura":
{ Args: { "p_captura": Json,"p_id": string }; Returns: Json
                           },
"tenant_publico":
{ Args: { "p_slug": string }; Returns: Json
                           },
"verificar_dictamen":
{ Args: { "p_token": string }; Returns: Json
                           }
          }
          Enums: {
            "accion_bitacora": "crear"|"actualizar"|"cambiar_estatus"|"sincronizar"|"aprobar"|"emitir_dictamen"|"subir_evidencia"|"eliminar"|"sugerencia_ia"|"decision_ia","estatus_inspeccion": "programada"|"en_curso"|"en_revision"|"dictaminada"|"cancelada","resultado_dictamen": "cumple"|"no_cumple","rol": "admin"|"coordinador"|"inspector"|"responsable","tipo_evidencia": "foto"|"documento","tipo_plantilla": "acta"|"dictamen"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "accion_bitacora": ["crear", "actualizar", "cambiar_estatus", "sincronizar", "aprobar", "emitir_dictamen", "subir_evidencia", "eliminar", "sugerencia_ia", "decision_ia"],"estatus_inspeccion": ["programada", "en_curso", "en_revision", "dictaminada", "cancelada"],"resultado_dictamen": ["cumple", "no_cumple"],"rol": ["admin", "coordinador", "inspector", "responsable"],"tipo_evidencia": ["foto", "documento"],"tipo_plantilla": ["acta", "dictamen"]
          }
        }
} as const
