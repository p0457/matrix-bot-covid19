import { MatrixClient, RichReply } from "matrix-bot-sdk";
import { LogService } from "matrix-js-snippets";
import striptags = require("striptags");
import config from "./config";
const axios = require("axios");
const moment = require("moment");

export class CommandProcessor {
    constructor(private client: MatrixClient) {
    }

    public tryCommand(roomId: string, event: any): Promise<any> {
        const message = event['content']['body'].trim().toLowerCase();
        const command = message.substring("!covid19 ".length);

        const apiRoot = "http://covid2019-api.herokuapp.com";
        const apiVersion = "v2";
        const apiVersioned = `${apiRoot}/${apiVersion}`;
        let url = apiVersioned;

        try {
            if (command === "help") {
                let helpText = "<h4>COVID-19 Bot Help</h4><pre><code>";
                helpText += "!covid19 help              - Shows this help menu\n";
                helpText += "!covid19 total|totals      - Get global totals\n";
                helpText += "!covid19 confirmed         - Get global confirmed case counts\n";
                helpText += "!covid19 death|deaths      - Get global death counts\n";
                helpText += "!covid19 recovered         - Get global recovered counts\n";
                helpText += "!covid19 active            - Get global active case counts\n";
                helpText += "!covid19 country [COUNTRY] - Get totals for country";
                helpText += "!covid19 time [YYYY-MM-DD] - Get global totals for specific date";
                helpText += "</code></pre>";
                return this.sendHtmlReply(roomId, event, helpText);
            }
            /*
                Totals
                http://covid2019-api.herokuapp.com/docs#/v2/get_total_v2_total_get
            */
            if (command === "total" || command === "totals") {
                url = `${url}/total`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data) {
                        const data = response.data.data;
                        result = "<h4>COVID-19 Global Totals</h4>";
                        if (data.confirmed) {
                            result += `<b>Confirmed Cases:</b> ${this.formatNumber(data.confirmed)}<br/>`;
                        }
                        if (data.active) {
                            result += `<b>Active Cases:</b> ${this.formatNumber(data.active)}<br/>`;
                        }
                        if (data.deaths) {
                            result += `<b>Deaths:</b> ${this.formatNumber(data.deaths)}<br/>`;
                        }
                        if (data.recovered) {
                            result += `<b>Recovered:</b> ${this.formatNumber(data.recovered)}<br/>`;
                        }
                    }
                    return result;
                });
            }
            /*
                Confirmed
                http://covid2019-api.herokuapp.com/docs#/v2/get_confirmed_v2_confirmed_get
            */
            if (command === "confirmed") {
                url = `${url}/confirmed`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data) {
                        const data = response.data.data;
                        result = `<h4>COVID-19 Confirmed Cases</h4><b>${this.formatNumber(data)}</b><br/>`;
                    }
                    return result;
                });
            }
            /*
                Deaths
                http://covid2019-api.herokuapp.com/docs#/v2/get_deaths_v2_deaths_get
            */
            if (command === "death" || command === "deaths" || command === "dead" || command === "died" || command === "deceased") {
                url = `${url}/deaths`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data) {
                        const data = response.data.data;
                        result = `<h4>COVID-19 Deaths</h4><b>${this.formatNumber(data)}</b><br/>`;
                    }
                    return result;
                });
            }
            /*
                Recovered
                http://covid2019-api.herokuapp.com/docs#/v2/get_recovered_v2_recovered_get
            */
            if (command === "recovered" || command === "recovery" || command === "recover") {
                url = `${url}/recovered`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data) {
                        const data = response.data.data;
                        result = `<h4>COVID-19 Recovered</h4><b>${this.formatNumber(data)}</b><br/>`;
                    }
                    return result;
                });
            }
            /*
                Active
                http://covid2019-api.herokuapp.com/docs#/v2/get_active_v2_active_get
            */
            if (command === "active") {
                url = `${url}/active`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data) {
                        const data = response.data.data;
                        result = `<h4>COVID-19 Active Cases</h4><b>${this.formatNumber(data)}</b><br/>`;
                    }
                    return result;
                });
            }
            /*
                Country
                http://covid2019-api.herokuapp.com/docs#/v2/get_country_v2_country__country_name__get
            */
            if (command.startsWith("country ")) {
                const country = command.substring("country ".length);
                url = `${url}/country/${country}`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data) {
                        const data = response.data.data;
                        if (data.location) {
                            const location = data.location;
                            result = `<h4>COVID-19 Data for <u>${location}</u></h4>`;
                            if (data.confirmed) {
                                result += `<b>Confirmed Cases:</b> ${this.formatNumber(data.confirmed)}<br/>`;
                            }
                            if (data.active) {
                                result += `<b>Active Cases:</b> ${this.formatNumber(data.active)}<br/>`;
                            }
                            if (data.deaths) {
                                result += `<b>Deaths:</b> ${this.formatNumber(data.deaths)}<br/>`;
                            }
                            if (data.recovered) {
                                result += `<b>Recovered:</b> ${this.formatNumber(data.recovered)}<br/>`;
                            }
                        }
                        else result = `No location found for <code>${country}</code>`;
                    }
                    return result;
                });
            }
            /*
                Time (Global only)
                http://covid2019-api.herokuapp.com/docs#/v2/get_time_series_v2_timeseries__case__get
            */
            if (command.startsWith("time ")) {
                const date = command.substring("time ".length);
                url = `${url}/timeseries/global`;

                // Check date
                const momentDate = moment(date, "YYYY-MM-DD");
                if (!momentDate.isValid()) return this.sendHtmlReply(roomId, event, `Date was invalid: <code>${date}</code>`);
                const dateKey = momentDate.format("M/D/YY");

                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data && Array.isArray(response.data.data)) {
                        const data = response.data.data;
                        const dataOnDate = data.find((d) => {
                            return Object.keys(d)[0] === dateKey;
                        });
                        if (dataOnDate) {
                            const actualData = dataOnDate[dateKey];
                            result = `<h4>COVID-19 Global Data for <u>${date}</u></h4>`;
                            if (actualData.confirmed) {
                                result += `<b>Confirmed Cases:</b> ${this.formatNumber(actualData.confirmed)}<br/>`;
                            }
                            if (actualData.deaths) {
                                result += `<b>Deaths:</b> ${this.formatNumber(actualData.deaths)}<br/>`;
                            }
                            if (actualData.recovered) {
                                result += `<b>Recovered:</b> ${this.formatNumber(actualData.recovered)}<br/>`;
                            }
                        }
                        else result = `No data found for date <code>${date}</code>`;
                    }
                    return result;
                });
            }
        } catch (err) {
            LogService.error("CommandProcessor", err);
            return this.sendHtmlReply(roomId, event, "There was an error processing your command");
        }
    }

    private getData(roomId: string, event: any, axiosOptions: any, processResponse: Function): Promise<any> {
        return new Promise((resolve, reject) => {
            axios(axiosOptions)
            .then((response) => {
                const messageContent = processResponse(response);
                if (messageContent) {
                    this.sendHtmlReply(roomId, event, messageContent);
                    resolve();
                } else {
                    this.sendHtmlReply(roomId, event, `Error processing data`);
                    resolve();
                }
            }, (error) => {
                LogService.error("CommandProcessor", error);
                this.sendHtmlReply(roomId, event, "There was an error processing your command");
                reject(error);
            });
            resolve();
        });
    }

    private formatNumber(num: number): string {
        if (!num) return 'Unknown';
        else return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
    };

    private sendHtmlReply(roomId: string, event: any, message: string): Promise<any> {
        const reply = RichReply.createFor(roomId, event, striptags(message), message);
        reply["msgtype"] = "m.notice";
        return this.client.sendMessage(roomId, reply);
    }
}
