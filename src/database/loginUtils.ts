import { IUser, User } from "./models";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { md5 } from "../utils";

function checkConnection(): boolean {
    if (mongoose.connection.readyState != mongoose.ConnectionStates.connected) {
        mongoose.connect("mongodb://vtorch:vtorch123@localhost:27017/vtorch");
    }
    return (
        mongoose.connection.readyState != mongoose.ConnectionStates.connected
    );
}

export async function CreateUser(
    username: string,
    originalPassword: string,
    email?: string,
    name?: string
): Promise<string> {
    if (checkConnection()) {
        return "Database not connected";
    }

    let salt: string = randomUUID();
    let encrypedPassword = md5(originalPassword + salt);
    let existingUser = await User.exists({ username: username });
    if (existingUser !== null) {
        return "User already exists!";
    }
    let newUser = new User({
        username: username,
        password: encrypedPassword,
        salt: salt,
        email: email,
        name: name,
    });
    await newUser.save();

    return "Success";
}

export async function Login(
    username: string,
    password: string
): Promise<String> {
    if (checkConnection()) {
        return "Database not connected";
    }
    let user = await User.findOne({ username: username });
    if (!user) {
        return "No such user!";
    }
    let encrypedPassword = md5(password + user.salt);
    if (encrypedPassword === user.password) {
		let cookie = randomUUID();
		user.cookie = cookie;
		await user.save();
		return cookie;
    }
    return "Incorrect password!";
}

export async function CheckLogin(username:string, cookie: string): Promise<boolean> {
	if (checkConnection()){
		return false;
	}
	let user = await User.findOne({ username: username });
	if (!user) {
        return false;
    }
	if (cookie === user.cookie){
		return true;
	}
	return false;
}
