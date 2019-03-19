import React, {Component, Fragment} from 'react';
import './App.css';

class App extends Component {
    tmpCurrentPos = 0;
    itemPerPage = 5;
    db;
    storeObject;

    constructor(props) {
        super(props);
        this.state = {
            isWebSql: true,
            currentPos: 0,
            offline: false,
            searchText: '',
            searchResultAll: [],
            searchResult: [],
            currentPageNumber: 1,
            maxPageCount: 0,
            dataLoadingInProgress: false
        };
        this.init();
    }

    init = () => {
        const isWebSql = true;
        if (window.openDatabase === undefined) {
            this.setState({isWebSql: false});
        }
        if (isWebSql) {
            this.initWebSQL();
        } else {
            this.initIndexedDB();
        }
    };

    initWebSQL = () => {

        this.createDatabase().then((db) => {
            this.db = db;
            db.transaction((tx) => {
                tx.executeSql('SELECT COUNT(*) AS rowcount FROM paragraph', [], (tx, results) => {
                    if (parseInt(results.rows[0]['rowcount']) !== 0) {
                        this.setState({offline: true});
                    }
                });
            });
        });
    };

    initIndexedDB = () => {
        const dbRequest = indexedDB.open('religion', 1);
        dbRequest.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('religion')) {
                const tweetListStore = db.createObjectStore('religion', {autoIncrement: true});
                tweetListStore.createIndex('religion', 'religion', {unique: false});
            }
        };
        dbRequest.onsuccess = (event) => {
            if (event.type === 'success') {
                const db = event.target.result;
                this.db = db;
                const transList = this.db.transaction('religion', 'readwrite');
                this.storeObject = transList.objectStore('religion');
                this.countIndexedDB().then((countIndexedDB) => {
                    if (countIndexedDB !== 0) {
                        this.setState({offline: true});
                    } else {

                    }
                });
            }
        }
    };


    countIndexedDB = () => {
        return new Promise((resolve, reject) => {
            this.storeObject.getAll().onsuccess = (event) => {
                if (event.type === 'success') {
                    resolve(event.target.result.length);
                }
            }
        });
    };


    insertRecordWebSQL = (tx, record) => {
        return new Promise((resolve, reject) => {
            tx.executeSql('INSERT INTO paragraph(_id,religion,book,pos,text) VALUES (?,?,?,?,?)',
                [record._id, record.religion, record.book, record.pos, record.text], (tx1) => {
                    this.tmpCurrentPos++;
                    if ((this.tmpCurrentPos / 500) === Math.floor(this.tmpCurrentPos / 500)) {
                        this.setState({currentPos: this.tmpCurrentPos});
                    }
                    resolve(record._id);
                });
        });
    };


    createData = () => {
        this.setState({dataLoadingInProgress: true});
        if (this.state.isWebSql) {
            this.createDataWebSQL();
        } else {
            this.createDataIndexedDB();
        }
    };

    createDataIndexedDB = () => {
        this.getData().then((records) => {
            const transList = this.db.transaction('religion', 'readwrite');
            this.storeObject = transList.objectStore('religion');
            Promise.all(records.map(record => this.insertRecordIndexedDB(record))).then(() => {
                this.setState({offline: true});
            });

        });
    };

    insertRecordIndexedDB = (record) => {
        return new Promise((resolve, reject) => {
            const add = this.storeObject.add(record);
            add.onsuccess = (addResult) => {
                if (addResult.type === 'success') {
                    this.tmpCurrentPos++;
                    if ((this.tmpCurrentPos / 500) === Math.floor(this.tmpCurrentPos / 500)) {
                        this.setState({currentPos: this.tmpCurrentPos});
                    }
                    resolve(record._id);
                }
            }

        });
    };

    createDataWebSQL = () => {
        this.getData().then((records) => {
            this.db.transaction((tx) => {
                Promise.all(records.map(record => this.insertRecordWebSQL(tx, record))).then((qqq) => {
                    this.setState({offline: true, currentPos: 0});
                });
            });
        });
    };


    getData = () => {
        return new Promise((resolve, reject) => {
            fetch('https://wordsonthestoneboard.com/backend/list')
                .then(res => res.json())
                .then(
                    (result) => {
                        resolve(result);
                    },
                    (error) => {
                    }
                )
        });
    };

    submit = (e) => {
        e.preventDefault();
        if (this.state.offline) {
            this.searchOffline();
        } else {
            this.searchOnline();
        }
    };

    searchOnline = () => {
        fetch('https://wordsonthestoneboard.com/backend/find/' + this.state.searchText)
            .then(res => res.json())
            .then(
                (result) => {
                    this.searchValueInit(result);
                },
                (error) => {
                }
            )
    };

    createDatabase = () => {
        return new Promise((resolve, reject) => {
            let db = window.openDatabase('religion', '1.0', 'Religion Database', 100 * 1024 * 1024);
            db.transaction(function (tx) {
                tx.executeSql('CREATE TABLE IF NOT EXISTS paragraph (_id,religion,book,pos,text)');
                resolve(db);
            })
        })
    };

    searchOffline = () => {
        if (this.state.isWebSql) {
            this.searchOfflineWebSQL();
        } else {
            this.searchOfflineIndexedDB();
        }
    };

    searchOfflineIndexedDB = () => {
        const transList = this.db.transaction('religion', 'readwrite');
        this.storeObject = transList.objectStore('religion');
        this.storeObject.getAll().onsuccess = (event) => {
            if (event.type === 'success') {
                const records = event.target.result.filter(record => String(record.text).valueOf().includes(this.state.searchText))
                this.searchValueInit(records);
            }
        }
    };

    searchOfflineWebSQL = () => {
        this.db.transaction((tx) => {
            tx.executeSql('SELECT * FROM paragraph WHERE text LIKE "%' + this.state.searchText + '%"', [], (tx, results) => {
                const searchResultAll = Array.from(results.rows);
                this.searchValueInit(searchResultAll);
            });
        });
    };

    searchValueInit = (searchResultAll) => {
        this.setState({
            currentPageNumber: 1,
            searchResultAll: searchResultAll,
            searchResult: searchResultAll.slice(0, this.itemPerPage),
            maxPageCount: Math.ceil(searchResultAll.length / this.itemPerPage)
        });
    };

    handleChange = (e) => {
        this.setState({
            [e.target.name]: e.target.value
        })
    };

    gotoPage = (pageNumber) => {
        const searchResultAll = this.state.searchResultAll;
        this.setState({
            currentPageNumber: pageNumber,
            searchResult: searchResultAll.slice((pageNumber - 1) * this.itemPerPage, pageNumber * this.itemPerPage),
        });
    };


    render() {
        return (
            <Fragment>
                <header>
                    <h1>
                        Words on the Stone Board
                        {this.state.offline ? (
                                ''
                            ) :
                            <button>
                                <span
                                    className={"fa " + (this.state.dataLoadingInProgress ? 'fa-sync fa-spin' : 'fa-cloud-download-alt')}
                                    onClick={this.createData}> </span>
                            </button>
                        }
                    </h1>
                    <p>{this.state.offline ? 'Offline' : 'Online'} {this.state.isWebSql ? 'WebSQL' : 'IndexedDB'}</p>
                    <p>{this.state.currentPos === 0 ? '' : 'import position: ' + this.state.currentPos}</p>
                    <form className="search" onSubmit={this.submit}>
                        <input type="text" placeholder="Type here something" name="searchText"
                               value={this.state.searchText} onChange={e => this.handleChange(e)}/>
                        <button type="submit">
                            <span className="fa fa-search"> </span>
                        </button>
                    </form>
                </header>
                {this.state.searchResultAll.length === 0 ?
                    '' :
                    <div className="list">
                        <div className="list-header">
                            <span>{this.state.searchResultAll.length} pcs</span>
                            <span className="blinking"> </span>
                            <div className="paginator">
                                <button className="fa fa-angle-double-left"
                                        disabled={this.state.currentPageNumber === 1}
                                        onClick={() => this.gotoPage(1)}></button>
                                <button className="fa fa-angle-left" disabled={this.state.currentPageNumber === 1}
                                        onClick={() => this.gotoPage(this.state.currentPageNumber - 1)}></button>
                                <span>{this.state.currentPageNumber} / {this.state.maxPageCount}</span>
                                <button className="fa fa-angle-right"
                                        disabled={this.state.currentPageNumber === this.state.maxPageCount}
                                        onClick={() => this.gotoPage(this.state.currentPageNumber + 1)}></button>
                                <button className="fa fa-angle-double-right"
                                        disabled={this.state.currentPageNumber === this.state.maxPageCount}
                                        onClick={() => this.gotoPage(this.state.maxPageCount)}></button>
                            </div>
                        </div>


                        {this.state.searchResult.map((record) => {
                            return (
                                <div key={record._id} className="content">
                                    <p className="religion">{record.religion}</p>
                                    <p className="text">{record.text}</p>
                                </div>
                            )
                        })
                        }
                    </div>
                }

            </Fragment>
        );
    }
}

export default App;
