import Config from "../config/index";
import express from "express";
import morgan from "morgan";
import session from "express-session";
const app = express();

app
	.set("trust proxy", true)
	.set("x-powered-by", false)
	.use(express.json())
	.use(express.urlencoded({ extended: true }))
	.use(morgan("dev"))
	.use(session({
		name:   "yiff-rocks",
		secret: Config.cookieSecret,
		cookie: {
			maxAge:   8.64e7,
			secure:   true,
			httpOnly: true,
			domain:   `.${Config.apiPublicHost}`
		},
		resave:            false,
		saveUninitialized: true
	}))
	.use("/files", (await import("./routes/files")).default)
	.use("/post_versions", (await import("./routes/post_versions")).default)
	.use("/posts", (await import("./routes/posts")).default)
	.use("/users", (await import("./routes/users")).default);


app.listen(Config.apiPort, Config.apiHost, () => console.log("Listening on http://%s:%s", Config.apiHost, Config.apiPort));
