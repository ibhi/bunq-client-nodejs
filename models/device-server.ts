export interface IDeviceServerOptions {
    method: string;
    id?: string;
    body?: IDeviceServerPostBody;
}

export interface IDeviceServerPostBody {
    description: string;
    secret: string;
    permitted_ips: Array<any>;
}