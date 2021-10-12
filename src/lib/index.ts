/**
 * Copyright 2021 Angus.Fenying <fenying@litert.org>
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

import * as $Path from 'path';
import * as $fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const $M = require('module');

const oldResolver = $M._resolveFilename;

interface IPackageConfig {

    root: string;

    prefixes: Record<string, string[]>;

    maps: Record<string, string[]>;

    disabled: boolean;
}

const pkgConfigs: Record<string, IPackageConfig> = {};

function findPackageRoot(filename: string): string {

    let dirPath = $Path.dirname(filename);

    do {
        const pkgPath = `${dirPath}/package.json`;

        if ($fs.existsSync(pkgPath)) {

            return dirPath;
        }

        const parentDir = $Path.dirname(dirPath);

        if (dirPath === parentDir) {

            break;
        }

        dirPath = parentDir;
        continue;

    } while (1);

    return '';
}

$M._resolveFilename = function(req: string, parentModule: any, isMain: boolean) {

    const baseDir = findPackageRoot(parentModule.filename);

    let prjCfg = pkgConfigs[baseDir];

    if (!prjCfg) {

        pkgConfigs[baseDir] = prjCfg = {
            'disabled': false,
            'maps': {},
            'prefixes': {},
            'root': baseDir
        };

        const configPath: string = $Path.join(prjCfg.root, 'tsconfig.json');
        let config: any;

        if ($fs.existsSync(configPath)) {

            config = (new Function('return ' + $fs.readFileSync(
                configPath,
                { 'encoding': 'utf8' }
            ).trim()))();

            if (
                !config.compilerOptions ||
                !config.compilerOptions.baseUrl ||
                !config.compilerOptions.paths
            ) {

                prjCfg.disabled = true;
            }
            else {

                config = config.compilerOptions;

                if (!config.rootDir) {

                    config.rootDir = '.';
                }

                if (!config.outDir) {

                    config.outDir = config.rootDir;
                }
            }
        }
        else {

            prjCfg.disabled = true;
        }

        if (prjCfg.disabled) {

            return oldResolver.call(this, req, parentModule, isMain);
        }

        if (config.baseUrl) {

            const rootDir = $Path.resolve(prjCfg.root, config.rootDir);
            const outDir = $Path.resolve(prjCfg.root, config.outDir);

            for (const k in config.paths) {

                if (k.endsWith('*')) {

                    prjCfg.prefixes[k.slice(0, -1)] = config.paths[k].map(
                        (x: string) => $Path.resolve(
                            prjCfg.root,
                            config.baseUrl,
                            x.slice(0, -1)
                        ).replace(rootDir, outDir)
                    );
                }
                else {

                    prjCfg.maps[k] = config.paths[k].map(
                        (x: string) => $Path.resolve(
                            prjCfg.root,
                            config.baseUrl,
                            x
                        ).replace(rootDir, outDir)
                    );
                }
            }
        }
        else {

            prjCfg.disabled = true;
        }
    }

    if (prjCfg.disabled) {

        return oldResolver.call(this, req, parentModule, isMain);
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
                        $Path.resolve(x, req.slice(prefix.length)),
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
