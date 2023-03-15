import { HttpClient, HttpEventType } from '@angular/common/http';
import { Component } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';
import { MatDialog } from '@angular/material/dialog';
import { LoadingDialogComponent } from '../alerts/loading-dialog.component';
import * as Papa from 'papaparse';

@Component({
  selector: 'app-icd-map',
  templateUrl: './icd-map.component.html',
  styleUrls: ['./icd-map.component.css']
})
export class IcdMapComponent {
  eclReason = '< 404684003 |Clinical finding|';
  selectedReasonSct: any;
  selectedReasonCIE: any[] = [];
  selectedReasonCIE11: any[] = [];
  icd11Data: any[] = [];
  icd11MapData: any[] = [];
  term: string = '';

  chips = [
    { code : '195967001', display : 'Asthma' },
    { code : '421671002', display : 'Pneumonia with AIDS (acquired immunodeficiency syndrome)' },
    { code : '16705321000119109', display : 'Neoplasm of right kidney' }
    ];

  constructor(private terminologyService: TerminologyService, private http: HttpClient, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.fetchTsvFile();
  }

  setChip(chip: any) {
    this.term = chip.display;
    this.selectedReasonSct = chip;
    this.updateReason(chip);
  }

  async updateReason(event: any) {
    this.selectedReasonSct = event;
    // ^[*] 447562003 |ICD-10 complex map reference set| {{ M referencedComponentId = "782513000" }}
    if (event && event.code) {
      this.matchIcd10(event);
      this.matchIcd11(event);
    }
  }

  matchIcd11(event: any) {
    this.selectedReasonCIE11 = [];
    // filter the icd11data array to the matching event.code
    let filteredData = this.icd11MapData.filter((element: any) => element.referencedComponentId == event.code);
    if (!filteredData || !filteredData[0].mapTarget) {
      this.selectedReasonCIE11.push([{ code: '', display: 'MAP SOURCE CONCEPT CANNOT BE CLASSIFIED WITH AVAILABLE DATA' }]);
    } else {
      // iterate over the filteredData based on mapGroup and mapPriority ascending order
      filteredData.sort((a: any, b: any) => {
        if (a.mapGroup < b.mapGroup) {
          return -1;
        }
        if (a.mapGroup > b.mapGroup) {
          return 1;
        }
        if (a.mapPriority < b.mapPriority) {
          return -1;
        }
        if (a.mapPriority > b.mapPriority) {
          return 1;
        }
        if (a.mapTarget < b.mapTarget) {
          return -1;
        }
        if (a.mapTarget > b.mapTarget ) {
          return 1;
        }
        return 0;
      });
      // iterate over the filteredData, for each mapGroup, create an array of all the mapTargets and push it to the selectedReasonCIE11 array
      let mapGroup = 0;
      let mapTargets: any[] = [];
      filteredData.forEach((element: any) => {
        if (element.mapGroup != mapGroup) {
          if (mapTargets.length > 0) {
            this.selectedReasonCIE11.push(mapTargets);
          }
          mapGroup = element.mapGroup;
          mapTargets = [];
        }
        let display = this.icd11Data.find((icd11Element: any) => icd11Element.Code == element.mapTarget);
        if (display) {
          console.log(display)
          display.Title = display?.Title?.replace(/- /g, '');
          mapTargets.push({ code: element.mapTarget, display: display.Title, uri: display["Foundation URI"]});
        } else {
          mapTargets.push({ code: element.mapTarget, display: 'Not found in ICD11'});
        }
      });
      if (mapTargets.length > 0) {
        this.selectedReasonCIE11.push(mapTargets);
      }
    }
  }

  matchIcd10(event: any) {
    this.selectedReasonCIE = [];
    let response = this.terminologyService.runEclLegacy(`^[*] 447562003 |ICD-10 complex map reference set| {{ M referencedComponentId = "${event.code}" }}`);
    response.subscribe(result => {
      // sort result.items by mapGroup , mapPriority and mapTarget
      result.items.sort((a: any, b: any) => {
        if (a.mapGroup < b.mapGroup) {
          return -1;
        }
        if (a.mapGroup > b.mapGroup) {
          return 1;
        }
        if (a.mapPriority < b.mapPriority) {
          return -1;
        }
        if (a.mapPriority > b.mapPriority) {
          return 1;
        }
        if (a.mapTarget < b.mapTarget) {
          return -1;
        }
        if (a.mapTarget > b.mapTarget ) {
          return 1;
        }
        return 0;
      });
      result.items.forEach( (element: any) => {
        if (element.mapRule == 'TRUE' || element.mapRule == 'IFA 248153007 | Male (finding) |') {
          // remove the second digit after the dot in element.mapTarget
          let dotIndex = element.mapTarget.indexOf('.');
          if (dotIndex > 0) {
            element.mapTarget = element.mapTarget.substring(0, dotIndex + 2) + element.mapTarget.substring(dotIndex + 3);
          }
          let cieCode = { code: element.mapTarget, display: ''};
          this.terminologyService.lookupOtherCodeSystems('http://hl7.org/fhir/sid/icd-10', cieCode.code).subscribe(lookupResponse => {
            if (lookupResponse?.parameter?.length > 0) {
              cieCode.display = lookupResponse.parameter.find((param: any) => param.name == 'display').valueString;
              this.selectedReasonCIE.push(cieCode);
            }
          });
        }
      });
    });
  }
  

  fetchTsvFile() {
    const dialogRef = this.dialog.open(LoadingDialogComponent, { disableClose: true });
    this.http
      .get('assets/icd11-map-preview.tsv', { responseType: 'text', reportProgress: true, observe: 'events' })
      .subscribe((event) => {
        if (event.type === HttpEventType.DownloadProgress) {
          // Calculate the progress percentage if possible
          if (event.total !== undefined) {
            const percentDone = Math.round((100 * event.loaded) / event.total);
            // console.log(`File is ${percentDone}% loaded.`);
            dialogRef.componentInstance.progress = percentDone;
          }
        } else if (event.type === HttpEventType.Response) {
          // Close the dialog when the file is loaded
          // dialogRef.close();
          // Parse the TSV data into a JavaScript object using Papa Parse
          if (typeof event.body === 'string') {
            const parsedData = Papa.parse(event.body, { header: true }).data;
            this.icd11MapData = parsedData;
            // console.log(parsedData);
          }
          this.http
          .get('assets/LinearizationMiniOutput-MMS-en.txt', { responseType: 'text', reportProgress: true, observe: 'events' })
          .subscribe((event) => {
            if (event.type === HttpEventType.DownloadProgress) {
              // Calculate the progress percentage if possible
              if (event.total !== undefined) {
                const percentDone = Math.round((100 * event.loaded) / event.total);
                // console.log(`File is ${percentDone}% loaded.`);
                dialogRef.componentInstance.progress = percentDone;
              }
            } else if (event.type === HttpEventType.Response) {
              // Close the dialog when the file is loaded
              dialogRef.close();
              // Parse the TSV data into a JavaScript object using Papa Parse
              if (typeof event.body === 'string') {
                const parsedData = Papa.parse(event.body, { header: true }).data;
                this.icd11Data = parsedData;
              }
            }
          });
        }
      });
  }

}
