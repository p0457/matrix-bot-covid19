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
        const commandLowerTrimmed = command.toLowerCase().trim();

        let url = "https://covid-api.com/api";

        try {
            if (command === "help") {
                const queryFieldDelimiter = config.queryFieldDelimiter;
                let helpText = "<h4>COVID-19 Bot Help</h4><pre><code>";
                helpText += "!covid19 help                                                        - Shows this help menu\n";
                helpText += "!covid19 source|sources                                              - Show the data source\n";
                helpText += "!covid19 regions                                                     - Get region ISO codes and names\n";
                helpText += "!covid19 provinces [ISO]                                             - Get provinces for region ISO\n";
                helpText += `!covid19 [YYYY-MM-DD|today|yesterday]* [ISO]${queryFieldDelimiter}[Province]${queryFieldDelimiter}[City Name]* - Get report for date (optional, default today), and location (optional, default global)\n`;
                helpText += "</code></pre>";
                return this.sendHtmlReply(roomId, event, helpText);
            }

            // Source
            if (command === "source" || command === "sources") {
                let message = `<b>Data provided by the COVID-19 Statistics API developed by axisbits in parternship with TAGSoft</b><br/>`;
                message += `<i>This bot is in no way affiliated with the creator of this API, but all thanks and support should go to the API creators below</i><br/></br>`;
                message += `<small><b>API Home Link:</b> https://covid-api.com/</small><br/>`;
                message += `<small><b>API Documentation:</b> https://covid-api.com/api</small><br/>`;
                message += `<small><b>API GitHub:</b> https://github.com/axisbits/covid-api</small>`;
                return this.sendHtmlReply(roomId, event, message);
            }

            // Regions
            else if (commandLowerTrimmed === "regions") {
                url = `${url}/regions`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
                        const data = response.data.data;
                        result = `<h4>COVID-19 Region ISO Codes and Names</h4><pre><code>`;
                        response.data.data.forEach((r) => {
                            if (r.iso && r.name) result += `${r.iso} - ${r.name}\n`;
                        });
                        result += "</code></pre>";
                    }
                    return result;
                });
            }

            // Provinces by ISO
            else if (commandLowerTrimmed.startsWith("provinces ")) {
                const iso = commandLowerTrimmed.substring("provinces ".length);
                url = `${url}/provinces/${iso}`;
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
                        const data = response.data.data;
                        
                        // Get max length of province names
                        const maxProvinceLength = Math.max.apply(Math, data.map(function(p) { return p.province.trim().length + 1; }));
                        const minimumProvinceLength = "Province Name ".length;
                        const provinceDisplayColumnLength = Math.max(maxProvinceLength, minimumProvinceLength);
                        // Get max length of latitude
                        const maxLatLength = Math.max.apply(Math, data.map(function(p) { return p.lat ? p.lat.length + 1 : 1; }));
                        const minimumLatLength = "Latitude ".length;
                        const latDisplayColumnLength = Math.max(maxLatLength, minimumLatLength);
                        // Get max length of longitude
                        const maxLongLength = Math.max.apply(Math, data.map(function(p) { return p.long ? p.long.length + 1 : 1; }));
                        const minimumLongLength = "Longitude ".length;
                        const longDisplayColumnLength = Math.max(maxLongLength, minimumLongLength);

                        result = `<h4>COVID-19 Provinces for ISO ${iso.toUpperCase()}</h4><pre><code>`;

                        let spaces = 0;
                        
                        result += "Province Name "; // A space as room for '-' in lines
                        spaces = provinceDisplayColumnLength - "Province Name ".length;
                        if (spaces > 0) result += new Array(spaces + 1).join(" ");
                        
                        result += "Latitude ";
                        spaces = latDisplayColumnLength - "Latitude ".length;
                        if (spaces > 0) result += new Array(spaces + 1).join(" ");
                        
                        result += "Longitude ";
                        spaces = longDisplayColumnLength - "Longitude ".length;
                        if (spaces > 0) result += new Array(spaces + 1).join(" ");

                        result += "\n";

                        data.forEach((d) => {
                            result += `${d.province.trim()}`;
                            spaces = provinceDisplayColumnLength - d.province.trim().length;
                            if (spaces > 0) result += new Array(spaces + 1).join(" ");

                            let lat = d.lat;
                            if (!lat) lat = "N/A";
                            result += lat;
                            spaces = latDisplayColumnLength - lat.length;
                            if (spaces > 0) result += new Array(spaces + 1).join(" ");
                            
                            let long = d.long;
                            if (!long) long = "N/A";
                            result += long;
                            spaces = longDisplayColumnLength - long.length;
                            if (spaces > 0) result += new Array(spaces + 1).join(" ");

                            result += "\n";
                        });
                        result += "</code></pre>";
                    }
                    return result;
                });
            }

            // Reports
            else {
                let query = commandLowerTrimmed;
                let locationQuery = query;
                let potentialDate = "today";
                let hasQuery = false;
                if (query.indexOf(" ") !== -1) { // Has a query
                    hasQuery = true;
                    potentialDate = query.substring(0, query.indexOf(" ")).toLowerCase();
                } else if (query) potentialDate = query;

                // Check date
                let validDate = false;
                let momentDate = new moment();
                momentDate = momentDate.subtract(1, "days").add(config.tzOffsetHours, "hours"); // Technically need yesterday's data
                if (potentialDate === "yesterday") {
                    validDate = true;
                    locationQuery = query.substring("yesterday ".length);
                } else if (potentialDate === "today") {
                    validDate = true;
                    locationQuery = query.substring("today ".length);
                } else {
                    momentDate = moment(potentialDate, "YYYY-MM-DD");
                    if (momentDate.isValid()) {
                        validDate = true;
                        locationQuery = query.substring("YYYY-MM-DD ".length);
                    }
                }
                if (!validDate) return this.sendHtmlReply(roomId, event, `Date was invalid: <code>${potentialDate}</code>`);

                const dateToUse = momentDate.format("YYYY-MM-DD");

                let showCities = false;

                let location;

                if (hasQuery) {
                    if (!locationQuery) return this.sendHtmlReply(roomId, event, `Query was invalid`);
                    const locationQueryParts = locationQuery.split(config.queryFieldDelimiter);
                    if (!locationQueryParts || locationQueryParts.length === 0) return this.sendHtmlReply(roomId, event, `Query was invalid`);
                    const iso = locationQueryParts[0];
                    location = iso ? iso.toUpperCase() : "Earth";
                    let province;
                    if (locationQueryParts.length > 1) province = locationQueryParts[1].trim();
                    let cityName;
                    if (locationQueryParts.length > 2) cityName = locationQueryParts[2].trim();
                    showCities = cityName !== undefined && cityName.length > 0;

                    url = `${url}/reports?${this.stringifyQueryParams({
                        date: dateToUse,
                        iso,
                        region_province: province,
                        city_name: cityName
                    })}`;
                } else {
                    url = `${url}/reports/total?${this.stringifyQueryParams({ date: dateToUse })}`;
                    location = "Earth";
                }
                
                return this.getData(roomId, event, {  
                    method: 'get',
                    headers: {
                        "Accept": "application/json"
                    }, 
                    url
                }, (response) => {
                    let result = undefined;
                    if (response.data && response.data.data) {
                        let data = response.data.data;

                        if (!Array.isArray(response.data.data) && Object.keys(response.data.data).length > 0) {
                            data = [data];
                        }

                        // Only proceed if there is data
                        if (!data[0] || !data[0].last_update) {
                            LogService.warn("CommandProcessor.tryCommand(post-rest-call)", `Data was undefined for url: '${url}' and original message: '${message}'`);
                            return result = "0";
                        }

                        result = `<h4>COVID-19 Report for ${dateToUse}</h4><pre><code>${location}\n`;

                        // Should repeat one for each province
                        data.forEach((d) => {
                            const date = d.date;
                            const updated = d.last_update;
                            if (updated) { // Only proceed if there is data
                                const totalConfirmed = d.confirmed;
                                const totalDeaths = d.deaths;
                                const totalRecovered = d.recovered;
                                const totalActive = d.active;
                                const diffConfirmed = d.confirmed_diff;
                                const diffDeaths = d.deaths_diff;
                                const diffRecovered = d.recovered_diff;
                                const diffActive = d.active_diff;
                                const fatalityRate = d.fatality_rate;
                                const fatalityRatePercentage = (fatalityRate * 100).toFixed(2);
                                const region = d.region;

                                let indent = "  - ";
                                let cities;
                                let provinceLat;
                                let provinceLong;

                                if (region) {
                                    const iso = region.iso;
                                    const isoName = region.name;
                                    const province = region.province;
                                    provinceLat = region.lat;
                                    provinceLong = region.long;
                                    cities = region.cities;
                                    
                                    result += `${indent}${province} (${provinceLat},${provinceLong}) updated ${updated} (${this.timeSince(updated)})\n`;
                                    indent = indent.replace("-", " ");
                                    indent += "  - ";
                                }

                                if (provinceLat && provinceLong) result += `${indent}Google Maps: ${this.mapsUrl(provinceLat, provinceLong, "province")}\n`;
                                result += `${indent}Confirmed: ${this.formatNumber(totalConfirmed)} (diff ${this.formatNumber(diffConfirmed)})\n`;
                                result += `${indent}Deaths: ${this.formatNumber(totalDeaths)} (diff ${this.formatNumber(diffDeaths)})\n`;
                                result += `${indent}Recovered: ${this.formatNumber(totalRecovered)} (diff ${this.formatNumber(diffRecovered)})\n`;
                                result += `${indent}Active: ${this.formatNumber(totalActive)} (diff ${this.formatNumber(diffActive)})\n`;
                                result += `${indent}Fatality Rate: ${fatalityRatePercentage}%\n`;

                                // Don't process cities unless specified
                                if (showCities && cities && Array.isArray(cities) && cities.length > 0) {
                                    result += `${indent}City Data:\n`
                                    indent = indent.replace("-", " ");
                                    let cityIndent = indent + "  - ";
                                    cities.forEach((c) => {
                                        const cityName = c.name;
                                        const cityUpdated = c.last_update;
                                        if (cityUpdated) { // Only proceed if there is data
                                            const cityFips = c.fips;
                                            const cityLat = c.lat;
                                            const cityLong = c.long;
                                            const cityConfirmed = c.confirmed;
                                            const cityDeaths = c.deaths;
                                            const cityDiffConfirmed = c.confirmed_diff;
                                            const cityDiffDeaths = c.deaths_diff;
                                            result += `${cityIndent}${cityName} (${cityLat},${cityLong}) [FIPS: ${cityFips}] updated ${cityUpdated} (${this.timeSince(cityUpdated)})\n`;
                                            cityIndent = cityIndent.replace("-", " ");
                                            cityIndent += "  - ";
                                            result += `${cityIndent}Google Maps: ${this.mapsUrl(cityLat, cityLong, "city")}\n`;
                                            result += `${cityIndent}Confirmed: ${this.formatNumber(cityConfirmed)} (diff ${this.formatNumber(cityDiffConfirmed)})\n`;
                                            result += `${cityIndent}Deaths: ${this.formatNumber(cityDeaths)} (diff ${this.formatNumber(cityDiffDeaths)})\n`;
                                        }
                                    });
                                }
                            }
                        });
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
                if (messageContent === "0") {
                    this.sendHtmlReply(roomId, event, `No data found`);
                    resolve();
                } else if (!messageContent) {
                    this.sendHtmlReply(roomId, event, `Error processing data`);
                    resolve();
                } else {
                    this.sendHtmlReply(roomId, event, messageContent);
                    resolve();
                }
            }, (error) => {
                LogService.error("CommandProcessor", { axiosOptions, error });
                this.sendHtmlReply(roomId, event, "There was an error processing your command");
                reject(error);
            });
            resolve();
        });
    }

    private mapsUrl(lat: string, long: string, type: string): string {
        let zoomLevel = "7z";
        if (type === "iso") zoomLevel = "6z";
        else if (type === "province") zoomLevel = "7z";
        else if (type === "city") zoomLevel = "12z";

        const covidDataFilter = "!5m1!1e7";

        return `https://www.google.com/maps/@${lat},${long},${zoomLevel}/data=${covidDataFilter}`;
    }

    private timeSince(date: Date|string): string {
        let dateTemp = new Date();
        if (typeof date === 'string') {
          dateTemp = new Date(date);
        }
        const newDate = new Date();
        const diff = +newDate - +dateTemp;
        const seconds = Math.floor((diff) / 1000);
        let interval = Math.floor(seconds / 31536000);
      
        if (Math.abs(interval) > 1) {
          return Math.abs(interval) + ' years ' + (interval < 0 ? 'from now' : 'ago');
        }
        interval = Math.floor(seconds / 2592000);
        if (Math.abs(interval) > 1) {
          return Math.abs(interval) + ' months ' + (interval < 0 ? 'from now' : 'ago');
        }
        interval = Math.floor(seconds / 86400);
        if (Math.abs(interval) > 1) {
          return Math.abs(interval) + ' days ' + (interval < 0 ? 'from now' : 'ago');
        }
        interval = Math.floor(seconds / 3600);
        if (Math.abs(interval) > 1) {
          return Math.abs(interval) + ' hours ' + (interval < 0 ? 'from now' : 'ago');
        }
        interval = Math.floor(seconds / 60);
        if (Math.abs(interval) > 1) {
          return Math.abs(interval) + ' minutes ' + (interval < 0 ? 'from now' : 'ago');
        }
        return Math.floor(seconds) + ' seconds ' + (interval < 0 ? 'from now' : 'ago');
    }

    private stringifyQueryParams(params: object): string {
        let result = "";
        for (let key in params) {
            const val = params[key];
            if (val) {
                if (result !== "") result += "&";
                result += `${key}=${encodeURIComponent(val)}`;
            }
        }
        return result;
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
