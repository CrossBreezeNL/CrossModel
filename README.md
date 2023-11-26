# CrossModel Community Edition

## Getting started

Please install all necessary [prerequisites](https://github.com/eclipse-theia/theia/blob/master/doc/Developing.md#prerequisites) on your system.

For detailed instructions for a Windows machine, follow [this](./docs/PrerequisitesWindows..md) guide.

## Installing the application dependencies

    yarn

## Running the application

    yarn start:electron

_or:_

    yarn rebuild:electron
    cd applications/electron-app
    yarn start

_or:_ launch `Launch CrossModel Electron` configuration from VS code.

## Example Workspace

Under `examples/verdaccio-example/workspace` we provide an example workspace with some demo packages containing entities, relationships and system diagrams.
Each package represents a dedicated system or library and may depend on other packages.

Using a known package structure - npm in our case - we can re-use large parts of the package management to download dependencies that are not locally available from an external package registry.
In order to test this behavior, we use verdaccio as a local npm registry that provides some models that are needed by our workspace packages.
You can start verdaccio using

    yarn start:verdaccio

The local npm registry will be available under `http://localhost:4873/` where we already provide four packages by default.

After opening the workspace, you can install the necessary dependencies in the example workspace by opening a terminal in `examples/verdaccio-example/workspace` and execute

    npm install

This should download all dependencies into dedicated `node_modules` directories within the workspace.

Currently there is still an issue where new files are not recognized automatically, so you need to reload your workspace once for all the dependencies to be properly recognized.

## Developing

Start watching all packages, including `electron-app`, of your application with

    yarn watch

_or_ watch only specific packages with

    cd packages/<package-name>
    yarn watch

and the Electron example.

    cd applications/electron-app
    yarn watch

Run the example as [described above](#running-the-application).

Any code changes will be automatically detected and the application will be re-compiled.
If you only made changes to the frontend or plugins, simply reloading the running application with `F5` is enough.
If you also made changes to the backend, you can close and restart the application without manual re-compilation.

### Developing in Dev Container

You can work on CrossModel from within a Dev Container. The best way to do so is create a new Dev Container and cloning the repository in there. For instructions please consult [this](https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-a-git-repository-or-github-pr-in-an-isolated-container-volume) page.

## Packaging

To package the application use

    yarn theia:electron package

Depending on the platform, this will produce an executable or an installer for the application under `applications/electron-app/dist`.
Details about the packaging can be configured in `applications/electron-app/electron-builder.yml`.

## Structure

A general overview of the application architecture is provided in the [Architecture Overview](docs/Architecture.md).
The repository itself contains the following components structured as follows:

    ├── applications
    │   ├── browser-app              # Browser application
    │   └── electron-app             # Electron application
    ├── configs
    ├── docs                         # Documentation
    ├── examples
    │   ├── libraries                # Example libraries referenced in the local npm registry
    │   ├── registry                 # Local npm registry using Verdaccio
    │   └── workspace                # Workspace that can be opened in the tool
    ├── extensions                   # VS Code extensions
    │   └── crossmodel-lang          # CrossModel language support (through three servers)
    │       └── src
    │           ├── glsp-server      # Graphical modelling server based on GLSP
    │           ├── language-server  # Textual modelling server based on Langium
    │           ├── model-server     # Custom model server to provide access to the semantic models
    │           ├── extension.ts     # Extension starting the server process and the language client
    │           └── main.ts          # Server process starting up all servers
    └── packages                     # Theia extensions
            ├── core                 # Core customizations
            ├── form-client          # Form editor widget connecting to the model server
            ├── glsp-client          # Diagram configuration and widget using the GLSP server
            └── product              # Application-level modifications

## Used libraries and license

-   mui-x : MUI X is open core—base components are MIT-licensed, while more advanced features require a Pro or Premium commercial license. We are currently only using core-base
-   react-tabs: MIT
-   chevrotrain: This library is a dependency of langium. To get the Yaml language working in crossmodel an example implementation of the python language of chevrotrain has been used. This example has been modified to make it work for the yaml language.
    -   <https://github.com/Chevrotain/chevrotain>
    -   example that has been used: <https://github.com/Chevrotain/chevrotain/tree/master/examples/lexer/python_indentation>
