/**
 * Copyright 2019 Angus.Fenying <fenying@litert.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as $path from "path";
import * as $fs from "fs";
const $M = require("module");

const oldResolver = $M._resolveFilename;

let prjCfg = {
    "root": "" as string,
    "prefixes": {} as Record<string, string[]>,
    "maps": {} as Record<string, string[]>
};

let disabled = false;

$M._resolveFilename = function(req: string, parentModule: any, isMain: boolean) {

    const baseDir = $path.dirname(parentModule.filename);

    if (disabled || baseDir.includes("node_modules")) {

        return oldResolver.call(this, req, parentModule, isMain);
    }

    if (!prjCfg.root) {

        prjCfg.root = baseDir;

        let configPath: string;
        let config: any;

        do {

            configPath = $path.resolve(prjCfg.root, "tsconfig.json");

            if ($fs.existsSync(configPath)) {

                config = (new Function("return " + $fs.readFileSync(
                    configPath,
                    { "encoding": "utf8" }
                )))();

                if (
                    !config.compilerOptions ||
                    !config.compilerOptions.baseUrl ||
                    !config.compilerOptions.paths
                ) {

                    config = null;

                    disabled = true;

                    break;
                }

                config = config.compilerOptions;

                if (!config.rootDir) {

                    config.rootDir = ".";
                }

                if (!config.outDir) {

                    config.outDir = config.rootDir;
                }

                break;
            }

            const newDir = $path.resolve(prjCfg.root, "..");

            if (newDir === prjCfg.root) {

                break;
            }

            prjCfg.root = newDir;

        } while (1);

        if (!prjCfg.root || !config) {

            return oldResolver.call(this, req, parentModule, isMain);
        }

        if (config.baseUrl) {

            const rootDir = $path.resolve(prjCfg.root, config.rootDir);
            const outDir = $path.resolve(prjCfg.root, config.outDir);

            for (const k in config.paths) {

                if (k.endsWith("*")) {

                    prjCfg.prefixes[k.slice(0, -1)] = config.paths[k].map(
                        (x: string) => $path.resolve(
                            prjCfg.root,
                            config.baseUrl,
                            x.slice(0, -1)
                        ).replace(rootDir, outDir)
                    );
                }
                else {

                    prjCfg.maps[k] = config.paths[k].map(
                        (x: string) => $path.resolve(
                            prjCfg.root,
                            config.baseUrl,
                            x
                        ).replace(rootDir, outDir)
                    );
                }
            }
        }
    }

    let err;

    if (prjCfg.maps[req]) {

        for (const x of prjCfg.maps[req]) {

            try {

                return oldResolver.call(
                    this,
                    x,
                    parentModule,
                    isMain
                );
            }
            catch (e) {

                err = e;
            }
        }
    }
    else {

        for (const prefix in prjCfg.prefixes) {

            if (!req.startsWith(prefix)) {

                continue;
            }

            for (const x of prjCfg.prefixes[prefix]) {

                try {

                    return oldResolver.call(
                        this,
                        $path.resolve(x, req.slice(prefix.length)),
                        parentModule,
                        isMain
                    );
                }
                catch (e) {

                    err = e;
                }
            }
        }
    }

    if (err) {

        throw err;
    }

    return oldResolver.call(this, req, parentModule, isMain);
};
