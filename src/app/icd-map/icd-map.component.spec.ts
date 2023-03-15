import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IcdMapComponent } from './icd-map.component';

describe('Icd10MapComponent', () => {
  let component: IcdMapComponent;
  let fixture: ComponentFixture<IcdMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IcdMapComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IcdMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
