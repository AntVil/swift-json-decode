const vscode = require("vscode");

function jsonToSwift(json) {
	json = JSON.parse(json);

	if (typeof json !== "object") {
		throw Error("json is invalid")
	}

	return new SwiftDecodable("JsonDecodable", json).toSwiftCode(0) + "\n";
}

function activate(context) {
	let disposable = vscode.commands.registerCommand("swift-json-decode.convertToSwiftDecodable", () => {

		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const content = editor.document.getText();
			try {
				vscode.workspace.openTextDocument(
					{ content: jsonToSwift(content), language: "swift" }
				).then(
					doc => vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Two })
				);
			} catch (error) {
				vscode.window.showErrorMessage("Error converting JSON to Swift Decodable: " + error.message);
			}
		}
	});

	context.subscriptions.push(disposable);
}

module.exports = {
	activate
}

class SwiftDecodable {
	constructor(name, json) {
		this.name = name
		this.properties = []
		this.identifiers = []
		this.types = []
		this.structs = []

		for (let property of Object.keys(json)) {
			this.properties.push(property)
			this.identifiers.push(this.asIdentifier(property))

			let value = json[property];
			let [type, struct] = this.getType(property, value);
			this.types.push(type);

			if(struct !== null) {
				this.structs.push(struct);
			}
		}
	}

	getType(property, value) {
		if (value === null) {
			return ["Any?", null];
		} else if (typeof value === "string") {
			return ["String", null];
		} else if (typeof value === "number" || typeof value === "bigint") {
			if (String(value).includes(".")) {
				return ["Float", null];
			} else {
				return ["Int", null];
			}
		} else if (typeof value === "boolean") {
			return ["Boolean", null];
		} else if (typeof value === "object") {
			if (Array.isArray(value)) {
				let [type, struct] = this.getType(property, value[0]);
				return [`[${type}]`, struct];
			} else {
				let type = this.asType(property);
				return [type, new SwiftDecodable(type, value)];
			}
		}
	}

	asIdentifier(property) {
		return property.replace(/^[^\w]+/, "")
		.replace(/\s+(.)/g, (_, group) => group.toUpperCase())
		.replace(/\s/g, "")
		.replace(/^(.)/, (_, group) => group.toLowerCase());
	}

	asType(property) {
		return property.replace(/^[^\w]+/, "")
		.replace(/\s(.)/g, (_, group) => group.toUpperCase())
		.replace(/\s/g, "")
		.replace(/^(.)/, (_, group) => group.toUpperCase());
	}

	toSwiftCode(block) {
		let indentation = "    ".repeat(block);
		if (this.properties.length === 0) {
			return `${indentation}struct ${this.name}: Decodable {}`
		} else {
			let innerProperties = "\n";
			let codingKeys = "\n    " + indentation + "enum CodingKeys: String {\n";

			for(let i=0;i<this.properties.length;i++) {
				innerProperties += `${indentation}    let ${this.identifiers[i]}: ${this.types[i]}` + "\n";
				
				if(this.identifiers[i] == this.properties[i]){
					codingKeys += `${indentation}        case ${this.identifiers[i]}` + "\n";
				}else{
					codingKeys += `${indentation}        case ${this.identifiers[i]} = "${this.properties[i]}"` + "\n";
				}
			}

			codingKeys += "    " + indentation + "}\n";

			if(!codingKeys.includes("=")) {
				codingKeys = "";
			}

			let structString = "";

			for(let i=0;i<this.structs.length;i++) {
				structString += "\n" + this.structs[i].toSwiftCode(block + 1) + "\n";
			}

			return `${indentation}struct ${this.name}: Decodable {${innerProperties}${codingKeys}${structString}${indentation}}`;
		}
	}
}
