# setup-mysql

The missing action for MySQL :tada:

- Faster and simpler than containers
- Works on Linux, Mac, and Windows
- Supports different versions

[![Build Status](https://github.com/ankane/setup-mysql/workflows/build/badge.svg?branch=v1)](https://github.com/ankane/setup-mysql/actions)

## Getting Started

Add it as a step to your workflow

```yml
    - uses: ankane/setup-mysql@v1
```

## Versions

Specify a version

```yml
    - uses: ankane/setup-mysql@v1
      with:
        mysql-version: 8.0
```

Currently supports

Version | `8.0` | `5.7` | `5.6`
--- | --- | --- | ---
`ubuntu-20.04` | default | |
`ubuntu-18.04` | ✓ | default |
`ubuntu-16.04` | ✓ | default |
`macos-10.15` | default | ✓ | ✓
`windows-2019` | | default |

Test against multiple versions

```yml
    strategy:
      matrix:
        mysql-version: [8.0, 5.7, 5.6]
    steps:
    - uses: ankane/setup-mysql@v1
      with:
        mysql-version: ${{ matrix.mysql-version }}
```

## Extra Steps

Create a database

```yml
    - run: mysqladmin create testdb
```

Run queries

```yml
    - run: mysql -D testdb -e 'SELECT VERSION()'
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
