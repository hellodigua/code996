#!/usr/bin/env node

import { CLIManager } from './cli'

const cli = new CLIManager()
cli.parse(process.argv)
