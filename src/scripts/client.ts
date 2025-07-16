type SomeOf<T> = T[keyof T];

/** get /v1/health */
type GetV1HealthInput = {};

/** get /v1/health */
type GetV1HealthPositiveVariant1 = {
  status: "success";
  data: {
    status: string;
  };
};

/** get /v1/health */
interface GetV1HealthPositiveResponseVariants {
  200: GetV1HealthPositiveVariant1;
}

/** get /v1/health */
type GetV1HealthNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

/** get /v1/health */
interface GetV1HealthNegativeResponseVariants {
  400: GetV1HealthNegativeVariant1;
}

/** post /v1/callback */
type PostV1CallbackInput = {
  txHash: string;
  transaction: {
    senderAddress: string;
    txHash: string;
    memo: string;
  };
  txHash: string;
};

/** post /v1/callback */
type PostV1CallbackPositiveVariant1 = {
  status: "success";
  data: {
    status: string;
  };
};

/** post /v1/callback */
interface PostV1CallbackPositiveResponseVariants {
  200: PostV1CallbackPositiveVariant1;
}

/** post /v1/callback */
type PostV1CallbackNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

/** post /v1/callback */
interface PostV1CallbackNegativeResponseVariants {
  400: PostV1CallbackNegativeVariant1;
}

/** get /v1/beer-taps */
type GetV1BeerTapsInput = {
  location: string;
};

/** get /v1/beer-taps */
type GetV1BeerTapsPositiveVariant1 = {
  status: "success";
  data: {
    beerTaps: {
      id?: string | undefined;
      title: string;
      location: string;
      description?: string | undefined;
      transactionCurrency: string;
      transactionAmount: string;
      transactionMemo: string;
      transactionReceiverEns: string;
      identityVerificationRequired: boolean;
      identityVerificationConfig?:
        | {
            minimumAge: number;
            sessionTimeout: number;
            excludedCountries: string[];
            ofacCheck: boolean;
          }
        | undefined;
      identityVerification?: any | undefined;
    }[];
  };
};

/** get /v1/beer-taps */
interface GetV1BeerTapsPositiveResponseVariants {
  200: GetV1BeerTapsPositiveVariant1;
}

/** get /v1/beer-taps */
type GetV1BeerTapsNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

/** get /v1/beer-taps */
interface GetV1BeerTapsNegativeResponseVariants {
  400: GetV1BeerTapsNegativeVariant1;
}

/** get /v1/status/:txHash */
type GetV1StatusTxHashInput = {
  txHash: string;
};

/** get /v1/status/:txHash */
type GetV1StatusTxHashPositiveVariant1 = {
  status: "success";
  data: {
    txHash: string;
    status: "not_found" | "queued" | "processing" | "completed" | "failed";
    queuePosition?: number | undefined;
  };
};

/** get /v1/status/:txHash */
interface GetV1StatusTxHashPositiveResponseVariants {
  200: GetV1StatusTxHashPositiveVariant1;
}

/** get /v1/status/:txHash */
type GetV1StatusTxHashNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

/** get /v1/status/:txHash */
interface GetV1StatusTxHashNegativeResponseVariants {
  400: GetV1StatusTxHashNegativeVariant1;
}

/** post /v1/identity/verify */
type PostV1IdentityVerifyInput = {
  attestationId: 1 | 2;
  /** VcAndDiscloseProof from Self.xyz */
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  /** Array of BigNumberish public signals from Self.xyz proof */
  pubSignals: string[];
  userContextData: string;
};

/** post /v1/identity/verify */
type PostV1IdentityVerifyPositiveVariant1 = {
  status: "success";
  data: {
    isVerified: boolean;
    result?:
      | {
          isValid: boolean;
          isAgeValid: boolean;
          isOfacValid: boolean;
          nationality?: string | undefined;
          userIdentifier: string;
          attestationId: number;
          verifiedAt: number;
          expiresAt: number;
        }
      | undefined;
    error?: string | undefined;
    cachedAt?: number | undefined;
  };
};

/** post /v1/identity/verify */
interface PostV1IdentityVerifyPositiveResponseVariants {
  200: PostV1IdentityVerifyPositiveVariant1;
}

/** post /v1/identity/verify */
type PostV1IdentityVerifyNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

/** post /v1/identity/verify */
interface PostV1IdentityVerifyNegativeResponseVariants {
  400: PostV1IdentityVerifyNegativeVariant1;
}

/** post /v1/identity/config */
type PostV1IdentityConfigInput = {
  tapId: string;
  walletAddress: string;
};

/** post /v1/identity/config */
type PostV1IdentityConfigPositiveVariant1 = {
  status: "success";
  data: {
    appName?: (string | undefined) | undefined;
    logoBase64?: (string | undefined) | undefined;
    endpointType?:
      | (("https" | "celo" | "staging_celo" | "staging_https") | undefined)
      | undefined;
    endpoint?: (string | undefined) | undefined;
    header?: (string | undefined) | undefined;
    scope?: (string | undefined) | undefined;
    sessionId?: (string | undefined) | undefined;
    userId?: (string | undefined) | undefined;
    userIdType?: (("hex" | "uuid") | undefined) | undefined;
    devMode?: (boolean | undefined) | undefined;
    disclosures?:
      | (
          | {
              issuing_state?: boolean | undefined;
              name?: boolean | undefined;
              passport_number?: boolean | undefined;
              nationality?: boolean | undefined;
              date_of_birth?: boolean | undefined;
              gender?: boolean | undefined;
              expiry_date?: boolean | undefined;
              ofac?: boolean | undefined;
              excludedCountries?: string[] | undefined;
              minimumAge?: number | undefined;
            }
          | undefined
        )
      | undefined;
  };
};

/** post /v1/identity/config */
interface PostV1IdentityConfigPositiveResponseVariants {
  200: PostV1IdentityConfigPositiveVariant1;
}

/** post /v1/identity/config */
type PostV1IdentityConfigNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

/** post /v1/identity/config */
interface PostV1IdentityConfigNegativeResponseVariants {
  400: PostV1IdentityConfigNegativeVariant1;
}

/** get /v1/identity/status/:walletAddress/:tapId */
type GetV1IdentityStatusWalletAddressTapIdInput = {
  walletAddress: string;
  tapId: string;
};

/** get /v1/identity/status/:walletAddress/:tapId */
type GetV1IdentityStatusWalletAddressTapIdPositiveVariant1 = {
  status: "success";
  data: {
    isVerified: boolean;
    result?:
      | {
          isValid: boolean;
          isAgeValid: boolean;
          isOfacValid: boolean;
          nationality?: string | undefined;
          userIdentifier: string;
          attestationId: number;
          verifiedAt: number;
          expiresAt: number;
        }
      | undefined;
    error?: string | undefined;
    cachedAt?: number | undefined;
  };
};

/** get /v1/identity/status/:walletAddress/:tapId */
interface GetV1IdentityStatusWalletAddressTapIdPositiveResponseVariants {
  200: GetV1IdentityStatusWalletAddressTapIdPositiveVariant1;
}

/** get /v1/identity/status/:walletAddress/:tapId */
type GetV1IdentityStatusWalletAddressTapIdNegativeVariant1 = {
  status: "error";
  error: {
    message: string;
  };
};

/** get /v1/identity/status/:walletAddress/:tapId */
interface GetV1IdentityStatusWalletAddressTapIdNegativeResponseVariants {
  400: GetV1IdentityStatusWalletAddressTapIdNegativeVariant1;
}

export type Path =
  | "/v1/health"
  | "/v1/callback"
  | "/v1/beer-taps"
  | "/v1/status/:txHash"
  | "/v1/identity/verify"
  | "/v1/identity/config"
  | "/v1/identity/status/:walletAddress/:tapId";

export type Method = "get" | "post" | "put" | "delete" | "patch";

export interface Input {
  "get /v1/health": GetV1HealthInput;
  "post /v1/callback": PostV1CallbackInput;
  "get /v1/beer-taps": GetV1BeerTapsInput;
  "get /v1/status/:txHash": GetV1StatusTxHashInput;
  "post /v1/identity/verify": PostV1IdentityVerifyInput;
  "post /v1/identity/config": PostV1IdentityConfigInput;
  "get /v1/identity/status/:walletAddress/:tapId": GetV1IdentityStatusWalletAddressTapIdInput;
}

export interface PositiveResponse {
  "get /v1/health": SomeOf<GetV1HealthPositiveResponseVariants>;
  "post /v1/callback": SomeOf<PostV1CallbackPositiveResponseVariants>;
  "get /v1/beer-taps": SomeOf<GetV1BeerTapsPositiveResponseVariants>;
  "get /v1/status/:txHash": SomeOf<GetV1StatusTxHashPositiveResponseVariants>;
  "post /v1/identity/verify": SomeOf<PostV1IdentityVerifyPositiveResponseVariants>;
  "post /v1/identity/config": SomeOf<PostV1IdentityConfigPositiveResponseVariants>;
  "get /v1/identity/status/:walletAddress/:tapId": SomeOf<GetV1IdentityStatusWalletAddressTapIdPositiveResponseVariants>;
}

export interface NegativeResponse {
  "get /v1/health": SomeOf<GetV1HealthNegativeResponseVariants>;
  "post /v1/callback": SomeOf<PostV1CallbackNegativeResponseVariants>;
  "get /v1/beer-taps": SomeOf<GetV1BeerTapsNegativeResponseVariants>;
  "get /v1/status/:txHash": SomeOf<GetV1StatusTxHashNegativeResponseVariants>;
  "post /v1/identity/verify": SomeOf<PostV1IdentityVerifyNegativeResponseVariants>;
  "post /v1/identity/config": SomeOf<PostV1IdentityConfigNegativeResponseVariants>;
  "get /v1/identity/status/:walletAddress/:tapId": SomeOf<GetV1IdentityStatusWalletAddressTapIdNegativeResponseVariants>;
}

export interface EncodedResponse {
  "get /v1/health": GetV1HealthPositiveResponseVariants &
    GetV1HealthNegativeResponseVariants;
  "post /v1/callback": PostV1CallbackPositiveResponseVariants &
    PostV1CallbackNegativeResponseVariants;
  "get /v1/beer-taps": GetV1BeerTapsPositiveResponseVariants &
    GetV1BeerTapsNegativeResponseVariants;
  "get /v1/status/:txHash": GetV1StatusTxHashPositiveResponseVariants &
    GetV1StatusTxHashNegativeResponseVariants;
  "post /v1/identity/verify": PostV1IdentityVerifyPositiveResponseVariants &
    PostV1IdentityVerifyNegativeResponseVariants;
  "post /v1/identity/config": PostV1IdentityConfigPositiveResponseVariants &
    PostV1IdentityConfigNegativeResponseVariants;
  "get /v1/identity/status/:walletAddress/:tapId": GetV1IdentityStatusWalletAddressTapIdPositiveResponseVariants &
    GetV1IdentityStatusWalletAddressTapIdNegativeResponseVariants;
}

export interface Response {
  "get /v1/health":
    | PositiveResponse["get /v1/health"]
    | NegativeResponse["get /v1/health"];
  "post /v1/callback":
    | PositiveResponse["post /v1/callback"]
    | NegativeResponse["post /v1/callback"];
  "get /v1/beer-taps":
    | PositiveResponse["get /v1/beer-taps"]
    | NegativeResponse["get /v1/beer-taps"];
  "get /v1/status/:txHash":
    | PositiveResponse["get /v1/status/:txHash"]
    | NegativeResponse["get /v1/status/:txHash"];
  "post /v1/identity/verify":
    | PositiveResponse["post /v1/identity/verify"]
    | NegativeResponse["post /v1/identity/verify"];
  "post /v1/identity/config":
    | PositiveResponse["post /v1/identity/config"]
    | NegativeResponse["post /v1/identity/config"];
  "get /v1/identity/status/:walletAddress/:tapId":
    | PositiveResponse["get /v1/identity/status/:walletAddress/:tapId"]
    | NegativeResponse["get /v1/identity/status/:walletAddress/:tapId"];
}

export type Request = keyof Input;

export const endpointTags = {
  "get /v1/health": [],
  "post /v1/callback": [],
  "get /v1/beer-taps": [],
  "get /v1/status/:txHash": [],
  "post /v1/identity/verify": [],
  "post /v1/identity/config": [],
  "get /v1/identity/status/:walletAddress/:tapId": [],
};

const parseRequest = (request: string) =>
  request.split(/ (.+)/, 2) as [Method, Path];

const substitute = (path: string, params: Record<string, any>) => {
  const rest = { ...params };
  for (const key in params) {
    path = path.replace(`:${key}`, () => {
      delete rest[key];
      return params[key];
    });
  }
  return [path, rest] as const;
};

export type Implementation = (
  method: Method,
  path: string,
  params: Record<string, any>,
) => Promise<any>;

const defaultImplementation: Implementation = async (method, path, params) => {
  const hasBody = !["get", "delete"].includes(method);
  const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
  const response = await fetch(
    new URL(`${path}${searchParams}`, "https://yodl-store-webhook.fly.dev"),
    {
      method: method.toUpperCase(),
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(params) : undefined,
    },
  );
  const contentType = response.headers.get("content-type");
  if (!contentType) return;
  const isJSON = contentType.startsWith("application/json");
  return response[isJSON ? "json" : "text"]();
};

export class Client {
  public constructor(
    protected readonly implementation: Implementation = defaultImplementation,
  ) {}
  public provide<K extends Request>(
    request: K,
    params: Input[K],
  ): Promise<Response[K]> {
    const [method, path] = parseRequest(request);
    return this.implementation(method, ...substitute(path, params));
  }
}

// Usage example:
/*
const client = new Client();
client.provide("get /v1/user/retrieve", { id: "10" });
*/
