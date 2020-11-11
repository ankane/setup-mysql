# setup-mysql

The missing action for MySQL - no need to use containers :tada:

Supports:

- Linux and Mac (`ubuntu-20.04`, `ubuntu-18.04`, `ubuntu-16.04`, and `macos-10.15`)
- Different versions (`8.0`, `5.7`, and `5.6`)

[![Build Status](https://github.com/ankane/setup-mysql/workflows/build/badge.svg?branch=v1)](https://github.com/ankane/setup-mysql/actions)

## Getting Started

Add it as a step to your workflow

```yml
jobs:
  build:
    steps:
    - uses: ankane/setup-mysql@v1
```

Specify a version (defaults to the latest if no version is specified)

```yml
jobs:
  build:
    steps:
    - uses: ankane/setup-mysql@v1
      with:
        mysql-version: 8.0
```

Test against multiple versions

```yml
jobs:
  build:
    strategy:
      matrix:
        mysql-version: [8.0, 5.7, 5.6]
    steps:
    - uses: ankane/setup-mysql@v1
      with:
        mysql-version: ${{ matrix.mysql-version }}
```

## Related Actions

- [setup-mariadb](https://github.com/ankane/setup-mariadb)
- [setup-postgres](https://github.com/ankane/setup-postgres)
- [setup-mongodb](https://github.com/ankane/setup-mongodb)
- [setup-elasticsearch](https://github.com/ankane/setup-elasticsearch)

## Contributing

Everyone is encouraged to help improve this project. Here are a few ways you can help:

- [Report bugs](https://github.com/ankane/setup-mysql/issues)
- Fix bugs and [submit pull requests](https://github.com/ankane/setup-mysql/pulls)
- Write, clarify, or fix documentation
- Suggest or add new features
