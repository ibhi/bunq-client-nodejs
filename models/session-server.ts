export interface ISessionServerOptions {
    method: string;
    id?: string;
    body?: ISessionServerPostBody;
}

export interface ISessionServerPostBody {
    secret: string;
}