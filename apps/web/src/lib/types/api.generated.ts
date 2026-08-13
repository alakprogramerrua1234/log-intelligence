/**
 * Generado desde apps/api/openapi.json. No editar a mano.
 *
 *   uv run --directory apps/api python scripts/export_openapi.py
 *   pnpm --filter web generate:types
 */

export interface paths {
    "/api/v1/filters/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Filter Categories */
        get: operations["listFilterCategories"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/filters/suggest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Suggest
         * @description Autocomplete cross-categoría. Las categorías salen del catálogo, no de código.
         */
        get: operations["suggestFilterValues"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/filters/values": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Filter Values */
        get: operations["listFilterValues"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Logs
         * @description `GET /logs?filter[<key>]=<value>&q=...&limit=...&cursor=...`
         *
         *     Las claves de filtro no se enumeran aquí: se descubren del catálogo en
         *     runtime. Una clave desconocida devuelve 400 (`unknown_filter_category`);
         *     un cursor manipulado o de otro backend, 400 (`invalid_cursor`).
         */
        get: operations["listLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Healthz */
        get: operations["healthz_healthz_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * DetectionOut
         * @description One detection row, denormalized for the frontend Log type.
         */
        DetectionOut: {
            /** Description */
            description?: string | null;
            /** Event Id */
            event_id: string | null;
            /** Id */
            id: string;
            /** Log Source Id */
            log_source_id: string;
            /** Log Source Name */
            log_source_name: string;
            /** Name */
            name: string;
            /** Provider */
            provider?: string | null;
            /**
             * Relevance
             * @default 0
             */
            relevance: number;
            /** Sample Fields */
            sample_fields?: {
                [key: string]: unknown;
            } | null;
            /** Techniques */
            techniques: components["schemas"]["TechniqueRef"][];
        };
        /**
         * ErrorOut
         * @description Forma estándar de error de la API (ARCHITECTURE.md §3).
         *
         *     Nunca se devuelve 200 con un error dentro. `code` es estable y pensado para
         *     que el cliente ramifique sobre él; `detail` es para humanos.
         */
        ErrorOut: {
            /** Code */
            code: string;
            /** Detail */
            detail: string;
            /** Keys */
            keys?: string[];
        };
        /** FilterCategoryOut */
        FilterCategoryOut: {
            /** Detection Fk */
            detection_fk: string;
            /** Enabled */
            enabled: boolean;
            /** Key */
            key: string;
            /** Label */
            label: string;
            /** Order */
            order: number;
            /** Source Table */
            source_table: string;
            /** Ui Hint */
            ui_hint: string;
            /** Value Column */
            value_column: string;
            /** Value Type */
            value_type: string;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** PaginatedDetections */
        PaginatedDetections: {
            /** Items */
            items: components["schemas"]["DetectionOut"][];
            /** Next Cursor */
            next_cursor?: string | null;
            /** Total */
            total: number;
        };
        /** SuggestItem */
        SuggestItem: {
            /** Category */
            category: string;
            /** Display */
            display: string;
            /** Label */
            label: string;
            /** Value */
            value: string;
        };
        /** TechniqueRef */
        TechniqueRef: {
            /** Confidence */
            confidence: number;
            /** Id */
            id: string;
            /** Name */
            name: string;
            /** Tactic */
            tactic: string[];
            /** Technique Id */
            technique_id: string;
            /** Technique Name */
            technique_name: string;
        };
        /** ValidationError */
        ValidationError: {
            /** Context */
            ctx?: Record<string, never>;
            /** Input */
            input?: unknown;
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    listFilterCategories: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FilterCategoryOut"][];
                };
            };
        };
    };
    suggestFilterValues: {
        parameters: {
            query: {
                q: string;
                per_category?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SuggestItem"][];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    listFilterValues: {
        parameters: {
            query: {
                category: string;
                q?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string[];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    listLogs: {
        parameters: {
            query?: {
                /** @description Free-text search */
                q?: string;
                limit?: number;
                /** @description Opaque cursor from a previous next_cursor */
                cursor?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PaginatedDetections"];
                };
            };
            /** @description Unknown filter category or bad cursor */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorOut"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    healthz_healthz_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
}
