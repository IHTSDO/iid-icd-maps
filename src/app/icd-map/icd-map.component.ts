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
  genders: any[] = [
    {code: "248152002", display: "Female"},
    {code: "248153007", display: "Male"},
    {code: "000000000", display: "No information"}
  ];
  gender = this.genders[0];
  age = 35;

  eclReason = '< 404684003 |Clinical finding|';
  selectedReasonSct: any;
  selectedReasonCIE: any[] = [];
  selectedReasonCIE11: any[] = [];
  icd10Data: any[] = [];
  icd11Data: any[] = [];
  icd11MapData: any[] = [];
  term: string = '';

  icd10rules: any[] = [];
  icd10DisplayedColumns: string[] = ['mapGroup', 'mapPriority', 'mapRule', 'mapAdvice', 'mapTarget', 'link', 'result'];
  loadingIcd10 = false;
  icd11rules: any[] = [];
  icd11DisplayedColumns: string[] = ['mapGroup', 'mapPriority', 'mapRule', 'mapAdvice', 'mapTarget', 'result'];
  loadingIcd11 = false;

  chips = [
    { code : '195967001', display : 'Asthma' },
    { code : '421671002', display : 'Pneumonia with AIDS (acquired immunodeficiency syndrome)' },
    { code : '16705321000119109', display : 'Neoplasm of right kidney' },
    { code : '95208000', display : 'Photogenic epilepsy' },
    { code : '8619003', display : 'Infertile' },
    { code : '717934004', display : 'Osteomalacia due to vitamin D deficiency'}
    ];

  useICD10CodeSystem = false;
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
    if (event && event.code) {
      this.matchIcd10(event);
      this.matchIcd11(event);
    }
  }

  matchIcd11(event: any) {
    this.loadingIcd11 = true;
    this.selectedReasonCIE11 = [];
    this.icd11rules = [];
    let filteredData = this.icd11MapData.filter((element: any) => element.referencedComponentId == event.code);
    if (!filteredData || !filteredData[0].mapTarget) {
      this.selectedReasonCIE11.push([{ code: '', display: 'MAP SOURCE CONCEPT CANNOT BE CLASSIFIED WITH AVAILABLE DATA' }]);
      this.icd11rules = filteredData;
    } else {
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
      this.icd11rules = filteredData;
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
          display.Title = display?.Title?.replace(/- /g, '');
          let uri = display["Foundation URI"];
          if (!uri) {
            uri = display["Linearization (release) URI"];
          }
          mapTargets.push({ code: element.mapTarget, display: display.Title, uri: uri});
        } else {
          mapTargets.push({ code: element.mapTarget, display: 'Not found in ICD11'});
        }
      });
      if (mapTargets.length > 0) {
        this.selectedReasonCIE11.push(mapTargets);
      }
    }
    this.loadingIcd11 = false;
  }

  matchIcd10(event: any) {
    this.loadingIcd10 = true;
    this.icd10rules = [];
    this.selectedReasonCIE = [];
    let response = this.terminologyService.runEclLegacy(`^[*] 447562003 |ICD-10 complex map reference set| {{ M referencedComponentId = "${event.code}" }}`);
    response.subscribe(result => {
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
      this.icd10rules = result.items;
      let group = 0;
      result.items.forEach( (element: any) => {
        let passesMapRules = false;
        if (element.mapRule == 'TRUE' || element.mapRule == "OTHERWISE TRUE") {
          passesMapRules = true;
        } else {
          let localRule = element.mapRule;
          localRule = localRule.replace('IFA 248153007 | Male (finding) |', 'this.gender.code == "248153007"');
          localRule = localRule.replace('IFA 248152002 | Female (finding) |', 'this.gender.code == "248152002"');
          localRule = localRule.replace('IFA 445518008 | Age at onset of clinical finding (observable entity) |', 'this.age');
          localRule = localRule.replace('AND', '&&');
          localRule = localRule.replace('OR', '||');
          localRule = localRule.replace(' years', '');
          if (eval(localRule)) {
            passesMapRules = true;
          }
        }
        if ( passesMapRules && element.mapGroup !== group) {
            element.result = true;
            group = element.mapGroup;
            let searchCode = element.mapTarget;
            let dotIndex = element.mapTarget.indexOf('.');
            if (dotIndex > 0) {
              searchCode = element.mapTarget.substring(0, dotIndex + 2) + element.mapTarget.substring(dotIndex + 3);
            }
            if (element.mapTarget) {
              let cieCode = { code: element.mapTarget, display: '[Label not found]'};
              if (this.useICD10CodeSystem) {
                this.terminologyService.lookupOtherCodeSystems('http://hl7.org/fhir/sid/icd-10', searchCode).subscribe(lookupResponse => {
                  if (lookupResponse?.parameter?.length > 0) {
                    cieCode.display = lookupResponse.parameter.find((param: any) => param.name == 'display').valueString;
                  }
                  this.selectedReasonCIE.push(cieCode);
                });
              } else {
                cieCode.display = this.getDisplayFromICD10Data(searchCode);
                this.selectedReasonCIE.push(cieCode);
              }
              
            } else {
              let cieCode = { code: element.mapTarget, display: element.mapAdvice};
              this.selectedReasonCIE.push(cieCode);
            }
          
        }
      });
      this.loadingIcd10 = false;
    });
  }
  
  getDisplayFromICD10Data(code: string) {
    let display = this.icd10Data.find((element: any) => element.ICD10_Code == code);
    if (display) {
      return display.Short_Description;
    }
    return '';
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
              // dialogRef.close();
              // Parse the TSV data into a JavaScript object using Papa Parse
              if (typeof event.body === 'string') {
                const parsedData = Papa.parse(event.body, { header: true }).data;
                this.icd11Data = parsedData;
              }
              this.http
              .get('assets/icd102019-covid-expandedsyst_codes.txt', { responseType: 'text', reportProgress: true, observe: 'events' })
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
                    this.icd10Data = parsedData;
                  }
              }
          });
            }
          });
        }
      });
  }

  fetchICD10CsvFile() {
    const dialogRef = this.dialog.open(LoadingDialogComponent, { disableClose: true });
    this.http
      .get('assets/icd102019-covid-expandedsyst_codes.txt', { responseType: 'text', reportProgress: true, observe: 'events' })
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
          // Parse the CSV data into a JavaScript object using Papa Parse
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
                this.icd10Data = parsedData;
              }
            }
          });
        }
      });
  }

  removeSecondDigitAfterDot(code: string) {
    let dotIndex = code.indexOf('.');
    if (dotIndex > 0) {
      code = code.substring(0, dotIndex + 2) + code.substring(dotIndex + 3);
    }
    return code;
  }

}
