#!/usr/bin/env node

import { CLIManager } from './cli'

const cli = new CLIManager(process.argv)
cli.parse(process.argv)
