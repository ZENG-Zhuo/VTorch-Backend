import { Schema, model } from "mongoose";

export interface IUser {
    username: string;
    password: string;
    salt: string;
    cookie: string;
    email?: string;
    name?: string;
}
const userSchema = new Schema<IUser>({
    username: { type: String, required: true },
    password: { type: String, required: true },
    salt: { type: String, required: true },
    cookie: String,
    email: String,
    name: String,
});

export const User = model<IUser>("User", userSchema);
